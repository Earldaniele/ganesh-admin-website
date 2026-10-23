import { requireAdmin } from "@/lib/auth/session";
import { getMySqlPool, type DbRow } from "@/lib/mysql/db";
import { thumbnail } from "@/lib/media/thumbnail";
export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store", "content-type": "image/webp", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new Response(null, { status: 401, headers });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404, headers });
  const pool = getMySqlPool();
  if (!pool) return new Response(null, { status: 503, headers });
  try {
    const [rows] = await pool.execute("SELECT storage_path FROM media_assets WHERE id = ? AND deleted_at IS NULL AND mime_type LIKE 'image/%'", [id]) as unknown as [DbRow[], unknown];
    if (!rows[0]) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(await thumbnail(id, String(rows[0].storage_path))), { headers });
  } catch (error) { return new Response(null, { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 422, headers }); }
}
