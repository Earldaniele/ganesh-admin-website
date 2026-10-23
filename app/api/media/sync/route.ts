import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request";
import { getMySqlPool, type DbRow } from "@/lib/mysql/db";
import { MediaSyncInProgress, syncExistingMedia } from "@/lib/media/library";
export const runtime = "nodejs";
export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Sign in required." }, { status: 401 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  try {
    const [rows] = await pool.query("SELECT IS_USED_LOCK('ganesh_media_import') AS running") as unknown as [DbRow[], unknown];
    return Response.json({ running: Boolean(rows[0].running) }, { headers: { "cache-control": "private, no-store" } });
  } catch { return Response.json({ error: "Could not check media discovery. Refresh the library to retry." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!await requireAdmin()) return Response.json({ error: "Sign in required." }, { status: 401 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  try { return Response.json({ added: await syncExistingMedia(pool, new URL(request.url).origin) }); }
  catch (error) {
    if (error instanceof MediaSyncInProgress) return Response.json({ running: true }, { status: 202, headers: { "cache-control": "private, no-store" } });
    return Response.json({ error: "Could not sync existing media. Check the migration, storage permissions and PUBLIC_REPO_PATH, then retry." }, { status: 503 });
  }
}
