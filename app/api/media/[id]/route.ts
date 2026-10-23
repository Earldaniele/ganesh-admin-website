import path from "node:path";
import { rename, stat, unlink } from "node:fs/promises";
import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request";
import { getMySqlPool, type DbRow } from "@/lib/mysql/db";
import { libraryItem, mediaRoot, snapshots, usagesFor } from "@/lib/media/library";
import { deletionRestriction } from "@/lib/media/presentation";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "Invalid media ID." }, { status: 400 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  try {
    const [rows] = await pool.execute("SELECT * FROM media_assets WHERE id = ? AND deleted_at IS NULL", [id]) as unknown as [DbRow[], unknown];
    if (!rows[0]) return Response.json({ error: "This file was removed. Choose another file." }, { status: 404 });
    const origin = new URL(request.url).origin;
    if (new URL(request.url).searchParams.get("check") === "1" && !String(rows[0].storage_path).startsWith("external/")) {
      const storage = String(rows[0].storage_path);
      if (!/^content\/[a-f0-9-]{36}\.[a-z0-9]+$/i.test(storage)) throw new Error("Invalid storage path");
      try { await stat(path.join(mediaRoot(), storage)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return Response.json({ error: "This file is missing from storage. Choose another file or remove its library entry." }, { status: 404 }); }
    }
    return Response.json({ media: { ...libraryItem(rows[0], origin), usages: new URL(request.url).searchParams.get("check") === "1" ? [] : usagesFor(rows[0], await snapshots(pool), origin) } }, { headers: { "cache-control": "private, no-store" } });
  } catch { return Response.json({ error: "Could not check where this file is used. Retry before deleting." }, { status: 503 }); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Untrusted request origin." }, { status: 403 });
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "Invalid media ID." }, { status: 400 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  const connection = await pool.getConnection().catch(() => null);
  if (!connection) return Response.json({ error: "MariaDB is unavailable." }, { status: 503 });
  let original = "", trash = "", moved = false, committed = false, missingFileRemoved = false;
  try {
    // Serialize against save/publish, then acquire asset locks in the same order.
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    await connection.query("SELECT site_key FROM site_drafts ORDER BY site_key FOR UPDATE");
    const [rows] = await connection.execute("SELECT * FROM media_assets WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]) as unknown as [DbRow[], unknown];
    const asset = rows[0];
    if (!asset) { await connection.rollback(); return Response.json({ error: "Media no longer exists." }, { status: 404 }); }
    const usages = usagesFor(asset, await snapshots(connection), new URL(request.url).origin);
    if (usages.length) { await connection.rollback(); return Response.json({ error: deletionRestriction(usages, String(asset.mime_type).startsWith("video/") ? "video" : "image"), usages }, { status: 409 }); }
    if (!String(asset.storage_path).startsWith("external/")) {
      const storage = String(asset.storage_path);
      if (!/^content\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp|svg|avif|gif|ico|mp4|webm|mov)$/i.test(storage)) throw new Error("Invalid storage path.");
      const [shared] = await connection.execute("SELECT id FROM media_assets WHERE storage_path = ? AND id <> ? LIMIT 1", [storage, id]) as unknown as [DbRow[], unknown];
      if (shared.length) { await connection.rollback(); return Response.json({ error: "Another media asset owns this file too. Ask your administrator to resolve the duplicate before deleting." }, { status: 409 }); }
      original = path.join(mediaRoot(), storage); trash = `${original}.deleting`;
      await rename(original, trash).then(() => { moved = true; }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; missingFileRemoved = true; });
    }
    await connection.execute("UPDATE media_assets SET deleted_at = UTC_TIMESTAMP(6) WHERE id = ?", [id]);
    await connection.execute("DELETE FROM media_publications WHERE asset_id = ?", [id]);
    await connection.execute("INSERT INTO audit_logs (actor, action, asset_id, metadata) VALUES (?, 'media_deleted', ?, ?)", [user.id, id, JSON.stringify({ filename: asset.original_filename })]);
    await connection.commit(); committed = true;
    let cleanupPending = false;
    if (moved) await unlink(trash).catch(() => { cleanupPending = true; });
    await unlink(path.join(mediaRoot(), "thumbnails", `${id}.webp`)).catch(() => undefined);
    return Response.json({ ok: true, cleanupPending, missingFileRemoved, externalSourceRetained: Boolean(asset.source_url) || String(asset.storage_path).startsWith("external/") });
  } catch {
    if (!committed) { await connection.rollback().catch(() => undefined); if (moved) await rename(trash, original).catch(() => undefined); }
    return Response.json({ error: "Could not delete this file. Check storage permissions and retry." }, { status: 500 });
  } finally { connection.release(); }
}
