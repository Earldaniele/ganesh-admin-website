import { initialContent } from "./seed";
import { contentSnapshotSchema, type ContentSnapshot } from "./schema";
import { getMySqlPool, isMySqlConfigured, jsonColumn, type DbRow } from "@/lib/mysql/db";
import { requireAdmin } from "@/lib/auth/session";
import { collectMediaIds } from "./media-references";
import { reconcileCopyAliases } from "./copy-aliases";
import { lockContentMedia, assetUrl, mediaOrigins } from "../media/library";
import { findMediaReferences } from "./media-references";

export const CMS_SITE_KEY = "ganesh-main";

export type ContentEnvelope = {
  content: ContentSnapshot;
  version: number;
  updatedAt: string | null;
  configured: boolean;
};

function parseContent(value: unknown) {
  try {
    const parsed = contentSnapshotSchema.safeParse(jsonColumn(value));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export async function getDraftContent(): Promise<ContentEnvelope> {
  const pool = getMySqlPool();
  if (!pool) throw new Error("Configure MariaDB and run the migration and seed commands first.");
  try {
    const [rows] = await pool.execute("SELECT content, version, updated_at FROM site_drafts WHERE site_key = ? LIMIT 1", [CMS_SITE_KEY]) as unknown as [DbRow[], unknown];
    const row = rows[0];
    const parsed = row ? parseContent(row.content) : null;
    if (!parsed) throw new Error("The database draft is missing or invalid. Restore a valid snapshot before editing.");
    return { content: parsed, version: Number(row.version), updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null, configured: isMySqlConfigured() };
  } catch {
    throw new Error("Cannot load a valid MariaDB draft. Check XAMPP, environment configuration, migrations and seed. No content has been overwritten.");
  }
}

let lastValidPublication: ContentSnapshot | null = null;
export async function getPublishedContent(): Promise<ContentSnapshot> {
  const pool = getMySqlPool();
  if (!pool) return initialContent;
  try {
    const [rows] = await pool.execute("SELECT content FROM site_publications WHERE site_key = ? LIMIT 1", [CMS_SITE_KEY]) as unknown as [DbRow[], unknown];
    const parsed = parseContent(rows[0]?.content);
    if (parsed) lastValidPublication = parsed;
    return parsed ?? lastValidPublication ?? contentSnapshotSchema.parse(initialContent);
  } catch {
    return lastValidPublication ?? contentSnapshotSchema.parse(initialContent);
  }
}

export async function saveDraft(content: unknown, expectedVersion: number) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) return { ok: false as const, status: 400, error: "Invalid draft version." };
  const parsed = contentSnapshotSchema.safeParse(content);
  if (!parsed.success) return { ok: false as const, status: 422, error: "Content validation failed.", issues: parsed.error.issues };
  const pool = getMySqlPool();
  if (!pool) return { ok: false as const, status: 503, error: "CMS is not configured. Add the MySQL environment variables first." };
  const user = await requireAdmin();
  if (!user) return { ok: false as const, status: 401, error: "Sign in required." };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT version, content FROM site_drafts WHERE site_key = ? FOR UPDATE", [CMS_SITE_KEY]) as unknown as [DbRow[], unknown];
    try { await lockContentMedia(connection, parsed.data, process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001"); }
    catch (error) { await connection.rollback(); return { ok: false as const, status: 422, error: error instanceof Error ? error.message : "Invalid media reference." }; }
    for (const id of collectMediaIds(parsed.data)) {
      const [assets] = await connection.execute("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]) as unknown as [DbRow[], unknown];
      if (!assets.length) { await connection.rollback(); return { ok: false as const, status: 422, error: "An image reference is missing or deleted. Replace that image before saving." }; }
    }
    const currentVersion = rows[0] ? Number(rows[0].version) : 0;
    if (currentVersion !== expectedVersion) {
      await connection.rollback();
      return { ok: false as const, status: 409, error: "This draft changed in another session." };
    }
    let reconciled;
    try { reconciled = reconcileCopyAliases(parseContent(rows[0]?.content), parsed.data); }
    catch (error) { await connection.rollback(); return { ok: false as const, status: 422, error: error instanceof Error ? error.message : "Conflicting copy controls." }; }
    const nextVersion = currentVersion + 1;
    await connection.execute(`INSERT INTO site_drafts (site_key, schema_version, content, version, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE schema_version = VALUES(schema_version), content = VALUES(content), version = VALUES(version), updated_by = VALUES(updated_by), updated_at = UTC_TIMESTAMP(6)`, [CMS_SITE_KEY, parsed.data.schemaVersion, JSON.stringify(reconciled.content), nextVersion, user.id]);
    await connection.execute("INSERT INTO audit_logs (actor, action, metadata) VALUES (?, 'draft_saved', ?)", [user.id, JSON.stringify({ siteKey: CMS_SITE_KEY, version: nextVersion })]);
    await connection.commit();
    return { ok: true as const, version: nextVersion, reconciledFields: reconciled.reconciledFields, content: reconciled.content };
  } catch {
    await connection.rollback();
    return { ok: false as const, status: 500, error: "Could not save the draft. Check the database connection and retry." };
  } finally {
    connection.release();
  }
}

export async function publishDraft(expectedVersion: number) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false as const, status: 400, error: "Invalid draft version." };
  const pool = getMySqlPool();
  if (!pool) return { ok: false as const, status: 503, error: "CMS is not configured. Add the MySQL environment variables first." };
  const user = await requireAdmin();
  if (!user) return { ok: false as const, status: 401, error: "Sign in required." };
  if (!user.permissions.publish) return { ok: false as const, status: 403, error: "Your role cannot publish website content." };
  const connection = await pool.getConnection();
  let publishedVersion = expectedVersion;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT schema_version, content, version FROM site_drafts WHERE site_key = ? FOR UPDATE", [CMS_SITE_KEY]) as unknown as [DbRow[], unknown];
    const draft = rows[0];
    if (!draft || Number(draft.version) !== expectedVersion) {
      await connection.rollback();
      return { ok: false as const, status: 409, error: "This draft changed in another session." };
    }
    const content = parseContent(draft.content);
    if (!content) {
      await connection.rollback();
      return { ok: false as const, status: 422, error: "The draft content is invalid." };
    }
    publishedVersion = Number(draft.version);
    const origin = process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001";
    await lockContentMedia(connection, content, origin);
    for (const id of collectMediaIds(content)) {
      const [assets] = await connection.execute("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]) as unknown as [DbRow[], unknown];
      if (!assets.length) { await connection.rollback(); return { ok: false as const, status: 422, error: "A referenced image is missing. Replace it before publishing." }; }
      await connection.execute("INSERT IGNORE INTO media_publications (asset_id) VALUES (?)", [id]);
    }
    // Older content can refer to managed files by URL without an assetId.
    const [media] = await connection.query("SELECT * FROM media_assets WHERE deleted_at IS NULL") as unknown as [DbRow[], unknown];
    for (const asset of media) if (findMediaReferences(content, { id: String(asset.id), urls: [assetUrl(asset, origin), ...(asset.source_url ? [String(asset.source_url)] : [])] }, mediaOrigins(origin)).length) await connection.execute("INSERT IGNORE INTO media_publications (asset_id) VALUES (?)", [String(asset.id)]);
    await connection.execute(`INSERT INTO site_publications (site_key, schema_version, content, version, published_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE schema_version = VALUES(schema_version), content = VALUES(content), version = VALUES(version), published_by = VALUES(published_by), published_at = UTC_TIMESTAMP(6)`, [CMS_SITE_KEY, content.schemaVersion, JSON.stringify(content), publishedVersion, user.id]);
    const [revision] = await connection.execute("INSERT INTO content_revision_history (site_key, schema_version, content, version, published_by) VALUES (?, ?, ?, ?, ?)", [CMS_SITE_KEY, content.schemaVersion, JSON.stringify(content), publishedVersion, user.id]) as unknown as [{ insertId?: number }, unknown];
    await connection.execute("INSERT INTO audit_logs (actor, action, revision_id, metadata) VALUES (?, 'published', ?, ?)", [user.id, revision.insertId ?? null, JSON.stringify({ siteKey: CMS_SITE_KEY, version: publishedVersion })]);
    await connection.commit();
  } catch {
    await connection.rollback();
    return { ok: false as const, status: 500, error: "Could not publish the draft. The previous publication remains unchanged." };
  } finally {
    connection.release();
  }
  const revalidated = await notifyPublicRevalidation();
  return { ok: true as const, version: publishedVersion, revalidated };
}

export async function notifyPublicRevalidation() {
  const endpoint = process.env.PUBLIC_SITE_REVALIDATE_URL;
  const secret = process.env.PUBLIC_SITE_REVALIDATE_SECRET;
  if (!endpoint || !secret) return false;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ tag: "ganesh-content" }), cache: "no-store", signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}
