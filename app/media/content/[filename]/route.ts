import { readFile } from "node:fs/promises";
import path from "node:path";
import { getMySqlPool, type DbRow } from "@/lib/mysql/db";
import { getAdminUser } from "@/lib/auth/session";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp|svg|avif|gif|ico|mp4|webm|mov)$/.test(filename)) return new Response(null, { status: 404 });
  const pool = getMySqlPool();
  if (!pool) return new Response(null, { status: 503 });
  try {
    const [rows] = await pool.execute("SELECT a.mime_type, p.asset_id AS published FROM media_assets a LEFT JOIN media_publications p ON p.asset_id = a.id WHERE a.storage_path = ? AND a.deleted_at IS NULL", [`content/${filename}`]) as unknown as [DbRow[], unknown];
    const asset = rows[0];
    if (!asset || (!asset.published && !await getAdminUser())) return new Response(null, { status: 404 });
    const bytes = await readFile(path.join(path.resolve(/* turbopackIgnore: true */ process.env.CMS_MEDIA_DIR || "var/media"), "content", filename));
    const headers = { "content-type": String(asset.mime_type), "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "cache-control": asset.published ? "public, max-age=31536000, immutable" : "private, no-store", "accept-ranges": "bytes" };
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match?.[1] ? Number(match[1]) : 0;
      let end = match?.[2] ? Number(match[2]) : bytes.length - 1;
      if (match && !match[1] && match[2]) { start = Math.max(0, bytes.length - Number(match[2])); end = bytes.length - 1; }
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${bytes.length}` } });
      end = Math.min(end, bytes.length - 1);
      return new Response(bytes.subarray(start, end + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${bytes.length}`, "content-length": String(end - start + 1) } });
    }
    return new Response(bytes, { headers: { ...headers, "content-length": String(bytes.length) } });
  } catch (error) { return new Response(null, { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 503, headers: { "cache-control": "private, no-store" } }); }
}
