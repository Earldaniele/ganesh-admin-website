import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolConnection } from "mysql2/promise";
import { jsonColumn, type DbRow } from "../mysql/db.ts";
import { collectMediaSources, findMediaReferences, mediaUrlKey } from "../content/media-references.ts";
import type { LibraryMedia, MediaUsage } from "./types.ts";

export function mediaRoot() { return path.resolve(/* turbopackIgnore: true */ process.env.CMS_MEDIA_DIR || "var/media"); }
export function mediaOrigins(origin: string) {
  return [...new Set([origin, process.env.CMS_MEDIA_ORIGIN, process.env.PUBLIC_SITE_ORIGIN].filter(Boolean).map((url) => new URL(url!).origin))];
}
export function assetUrl(row: DbRow, origin: string) {
  return String(row.storage_path).startsWith("external/") ? String(row.source_url) : `${(process.env.CMS_MEDIA_ORIGIN || origin).replace(/\/$/, "")}/media/${row.storage_path}`;
}
export async function snapshots(db: Pool | PoolConnection) {
  const result: { location: string; content: unknown }[] = [];
  for (const [table, label] of [["site_drafts", "Draft"], ["site_publications", "Published"], ["content_revision_history", "Revision"]]) {
    const [rows] = await db.query(`SELECT site_key, version, content FROM ${table}`) as unknown as [DbRow[], unknown];
    for (const row of rows) result.push({ location: `${label} ${row.version} · ${row.site_key}`, content: jsonColumn(row.content) });
  }
  // These are still used by the public website during database outages and initial rendering.
  for (const filename of ["initial-content.json", "current-design.json"]) {
    result.push({ location: `Website fallback · ${filename}`, content: JSON.parse(await readFile(path.join(process.cwd(), "lib/content", filename), "utf8")) });
  }
  return result;
}
export function usagesFor(row: DbRow, content: Awaited<ReturnType<typeof snapshots>>, origin: string): MediaUsage[] {
  return content.flatMap((snapshot) => findMediaReferences(snapshot.content, { id: String(row.id), urls: [assetUrl(row, origin), ...(row.source_url ? [String(row.source_url)] : [])] }, mediaOrigins(origin)).map((field) => ({ location: snapshot.location, path: field })));
}
export async function listMedia(pool: Pool, origin: string): Promise<LibraryMedia[]> {
  const [rows] = await pool.query("SELECT * FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at DESC, id") as unknown as [DbRow[], unknown];
  const content = await snapshots(pool);
  return rows.map((row) => ({
    assetId: String(row.id), src: assetUrl(row, origin), alt: String(row.alt_text || ""), filename: String(row.original_filename),
    mimeType: String(row.mime_type), size: String(row.storage_path).startsWith("external/") ? null : Number(row.size_bytes),
    uploadedAt: row.source_url ? null : new Date(row.created_at as string).toISOString(),
    width: row.width ? Number(row.width) : null, height: row.height ? Number(row.height) : null,
    existing: Boolean(row.source_url), usages: usagesFor(row, content, origin),
  }));
}
const mimeTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", gif: "image/gif", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

/** Idempotently catalogue original website media without rewriting any content URLs. */
export async function syncExistingMedia(pool: Pool, origin: string) {
  const connection = await pool.getConnection();
  let added = 0;
  try {
    const [lock] = await connection.query("SELECT GET_LOCK('ganesh_media_import', 10) AS acquired") as unknown as [DbRow[], unknown];
    if (Number(lock[0].acquired) !== 1) throw new Error("Media sync is already running. Retry shortly.");
    const [rows] = await connection.query("SELECT * FROM media_assets") as unknown as [DbRow[], unknown];
    const origins = mediaOrigins(origin);
    const known = new Set(rows.flatMap((row) => [mediaUrlKey(assetUrl(row, origin), origins), ...(row.source_url ? [mediaUrlKey(String(row.source_url), origins)] : [])]));
    const sources = new Map<string, { src: string; alt: string; file?: string }>();
    const publicRoot = path.resolve(/* turbopackIgnore: true */ process.env.PUBLIC_REPO_PATH || "../ganesh-website", "public");
    async function scan(folder: string, prefix = "") {
      const entries = await readdir(folder, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const relative = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) await scan(path.join(folder, entry.name), relative);
        else if (mimeTypes[path.extname(entry.name).slice(1).toLowerCase()]) sources.set(relative, { src: relative, alt: entry.name.replace(/\.[^.]+$/, ""), file: path.join(folder, entry.name) });
      }
    }
    await scan(publicRoot);
    for (const snapshot of await snapshots(connection)) for (const source of collectMediaSources(snapshot.content)) {
      const key = mediaUrlKey(source.src, origins);
      if (key.startsWith("/media/content/")) continue; // Already managed, including deleted files.
      sources.set(key, { ...sources.get(key), ...source });
    }
    for (const [key, source] of sources) {
      if (known.has(key)) continue;
      const url = new URL(source.src, process.env.PUBLIC_SITE_ORIGIN || "http://localhost:3000");
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const extension = path.extname(url.pathname).slice(1).toLowerCase();
      const mime = mimeTypes[extension];
      if (!mime) continue;
      const id = randomUUID();
      const relative = source.file ? `content/${id}.${extension}` : `external/${id}`;
      let copied = false;
      try {
        const info = source.file ? await stat(source.file) : null;
        if (source.file) { await mkdir(path.join(mediaRoot(), "content"), { recursive: true }); await copyFile(source.file, path.join(mediaRoot(), relative)); copied = true; }
        await connection.execute("INSERT INTO media_assets (id,storage_path,mime_type,size_bytes,original_filename,alt_text,source_url,source_key) VALUES (?,?,?,?,?,?,?,?)", [id, relative, mime, info?.size || 0, decodeURIComponent(path.basename(url.pathname)).slice(0,255), source.alt.slice(0,300), url.href, createHash("sha256").update(key).digest("hex")]);
        known.add(key); added++;
      } catch (error) { if (copied) await unlink(path.join(mediaRoot(), relative)).catch(() => undefined); throw error; }
    }
    return added;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('ganesh_media_import')").catch(() => undefined);
    connection.release();
  }
}

/** Writers lock the draft first, then asset rows. Delete follows the same order. */
export async function lockContentMedia(connection: PoolConnection, content: unknown, origin: string) {
  const [assets] = await connection.query("SELECT * FROM media_assets ORDER BY id FOR UPDATE") as unknown as [DbRow[], unknown];
  const origins = mediaOrigins(origin);
  const active = new Set(assets.filter((asset) => !asset.deleted_at).map((asset) => mediaUrlKey(assetUrl(asset, origin), origins)));
  for (const source of collectMediaSources(content)) {
    const key = mediaUrlKey(source.src, origins);
    if (key.startsWith("/media/content/") && !active.has(key)) throw new Error("A selected media file is missing or deleted. Choose another file from the Media Library.");
  }
  for (const asset of assets) {
    if (asset.deleted_at && findMediaReferences(content, { id: String(asset.id), urls: [assetUrl(asset, origin), ...(asset.source_url ? [String(asset.source_url)] : [])] }, mediaOrigins(origin)).length) throw new Error("A selected media file was deleted. Choose another file from the Media Library.");
  }
}
