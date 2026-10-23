import { randomUUID } from "node:crypto";
import { contentSnapshotSchema } from "./schema";
import { validateOrderBuilderConfig } from "./validation";
import { contentChanges, type SavedEditorDraft, type SavedEditorDraftSummary } from "../editor-changes";
import { getMySqlPool, jsonColumn, type DbRow } from "../mysql/db";
import { requireAdmin } from "../auth/session";
import { lockContentMedia } from "../media/library";
import { CMS_SITE_KEY } from "./store";
import { collectMediaIds } from "./media-references";
import { reconcileCopyAliases } from "./copy-aliases";

function summary(row: DbRow): SavedEditorDraftSummary {
  return { id: String(row.id), name: String(row.name), savedAt: new Date(row.saved_at as string).toISOString(), changeCount: Number(row.change_count), sections: jsonColumn(row.affected_sections) as string[] };
}
export async function listEditorDrafts() {
  const pool = getMySqlPool();
  if (!pool) throw new Error("Database unavailable.");
  const [rows] = await pool.execute("SELECT id, name, saved_at, change_count, affected_sections FROM saved_editor_drafts WHERE site_key = ? ORDER BY saved_at DESC, id", [CMS_SITE_KEY]) as unknown as [DbRow[], unknown];
  return rows.map(summary);
}
export async function getEditorDraft(id: string): Promise<SavedEditorDraft | null> {
  const pool = getMySqlPool();
  if (!pool) throw new Error("Database unavailable.");
  const [rows] = await pool.execute("SELECT * FROM saved_editor_drafts WHERE site_key = ? AND id = ?", [CMS_SITE_KEY, id]) as unknown as [DbRow[], unknown];
  const row = rows[0];
  if (!row) return null;
  return { ...summary(row), content: contentSnapshotSchema.parse(jsonColumn(row.content)), baseContent: contentSnapshotSchema.parse(jsonColumn(row.base_content)), changes: jsonColumn(row.changes) as SavedEditorDraft["changes"] };
}
export async function saveEditorDraft(input: { name?: unknown; content?: unknown; baseContent?: unknown }) {
  const user = await requireAdmin();
  if (!user) return { ok: false as const, status: 401, error: "Sign in required." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return { ok: false as const, status: 422, error: "Enter a draft name of 1–120 characters." };
  const content = contentSnapshotSchema.safeParse(input.content), base = contentSnapshotSchema.safeParse(input.baseContent);
  if (!content.success || !base.success) return { ok: false as const, status: 422, error: "Content validation failed. Check your fields before saving." };
  try { content.data = reconcileCopyAliases(base.data, content.data).content; }
  catch (failure) { return { ok: false as const, status: 422, error: failure instanceof Error ? failure.message : "Conflicting copy controls." }; }
  const issues = validateOrderBuilderConfig(content.data.orderBuilder);
  if (issues.length) return { ok: false as const, status: 422, error: issues.join(" ") };
  const pool = getMySqlPool();
  if (!pool) return { ok: false as const, status: 503, error: "Database unavailable. Your edits are retained." };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Match media deletion's lock order; both before and after images must stay available.
    await connection.execute("SELECT version FROM site_drafts WHERE site_key = ? FOR UPDATE", [CMS_SITE_KEY]);
    const origin = process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001";
    await lockContentMedia(connection, content.data, origin);
    await lockContentMedia(connection, base.data, origin);
    for (const id of new Set([...collectMediaIds(content.data), ...collectMediaIds(base.data)])) {
      const [assets] = await connection.execute("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]) as unknown as [DbRow[], unknown];
      if (!assets.length) { await connection.rollback(); return { ok: false as const, status: 422, error: "An image reference is missing or deleted. Replace it before saving." }; }
    }
    const changes = contentChanges(base.data, content.data);
    const draft: SavedEditorDraft = { id: randomUUID(), name, savedAt: new Date().toISOString(), content: content.data, baseContent: base.data, changes, changeCount: changes.length, sections: [...new Set(changes.map(c => `${c.page} / ${c.section}`))] };
    await connection.execute("INSERT INTO saved_editor_drafts (id, site_key, name, content, base_content, changes, change_count, affected_sections, saved_by, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [draft.id, CMS_SITE_KEY, name, JSON.stringify(draft.content), JSON.stringify(draft.baseContent), JSON.stringify(changes), changes.length, JSON.stringify(draft.sections), user.id, new Date(draft.savedAt)]);
    await connection.execute("INSERT INTO audit_logs (actor, action, metadata) VALUES (?, 'editor_draft_saved', ?)", [user.id, JSON.stringify({ siteKey: CMS_SITE_KEY, draftId: draft.id, name })]);
    await connection.commit();
    return { ok: true as const, draft };
  } catch (failure) {
    await connection.rollback();
    console.error("Named draft save failed", failure);
    return { ok: false as const, status: 503, error: "Could not save this draft. Check the database and media references, then retry. Your edits are retained." };
  } finally { connection.release(); }
}
