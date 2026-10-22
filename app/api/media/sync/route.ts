import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request";
import { getMySqlPool } from "@/lib/mysql/db";
import { syncExistingMedia } from "@/lib/media/library";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!await requireAdmin()) return Response.json({ error: "Sign in required." }, { status: 401 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  try { return Response.json({ added: await syncExistingMedia(pool, new URL(request.url).origin) }); }
  catch { return Response.json({ error: "Could not sync existing media. Check the migration, storage permissions and PUBLIC_REPO_PATH, then retry." }, { status: 503 }); }
}
