import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMySqlPool } from "@/lib/mysql/db";
import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request";
import { MAX_UPLOAD_BYTES, validateImage, validateVideo } from "@/lib/media/validate";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Untrusted request origin." }, { status: 403 });
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const pool = getMySqlPool();
  if (!pool) return Response.json({ error: "CMS is not configured." }, { status: 503 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_UPLOAD_BYTES + 65536) return Response.json({ error: "Upload exceeds 32 MB." }, { status: 413 });
  // Bound streamed multipart requests as well as requests with Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Choose an image or MP4 video." }, { status: 400 });
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > MAX_UPLOAD_BYTES + 65536) return Response.json({ error: "Upload exceeds 32 MB." }, { status: 413 });
      parts.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const form = await new Response(Buffer.concat(parts), { headers: { "content-type": request.headers.get("content-type") || "" } }).formData().catch(() => null);
  const file = form?.get("file");
  const alt = String(form?.get("alt") || "").trim();
  if (!(file instanceof File)) return Response.json({ error: "Choose an image or MP4 video file." }, { status: 400 });
  if (!alt || alt.length > 300) return Response.json({ error: "Describe the media in 1–300 characters." }, { status: 422 });
  let validated;
  try { const bytes = Buffer.from(await file.arrayBuffer()); validated = file.type === "video/mp4" ? validateVideo(bytes, file.type) : await validateImage(bytes, file.type); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid media." }, { status: 415 }); }
  const assetId = crypto.randomUUID();
  const relativePath = `content/${assetId}.${validated.extension}`;
  // Runtime-mounted media is not application source and must not be bundled.
  const mediaRoot = path.resolve(/* turbopackIgnore: true */ process.env.CMS_MEDIA_DIR || "var/media");
  const absolutePath = path.join(mediaRoot, relativePath);
  let fileWritten = false;
  const connection = await pool.getConnection().catch(() => null);
  if (!connection) return Response.json({ error: "MariaDB is unavailable." }, { status: 503 });
  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, validated.bytes, { flag: "wx" });
    fileWritten = true;
    await connection.beginTransaction();
    await connection.execute("INSERT INTO media_assets (id, storage_path, mime_type, size_bytes, width, height, original_filename, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [assetId, relativePath, validated.mime, validated.bytes.length, validated.width, validated.height, file.name.slice(0, 255), user.id]);
    await connection.execute("INSERT INTO audit_logs (actor, action, asset_id, metadata) VALUES (?, 'media_uploaded', ?, ?)", [user.id, assetId, JSON.stringify({ mime: validated.mime, bytes: validated.bytes.length })]);
    await connection.commit();
    const origin = (process.env.CMS_MEDIA_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
    return Response.json({ assetId, src: `${origin}/media/${relativePath}`, alt, width: validated.width, height: validated.height });
  } catch {
    await connection.rollback().catch(() => undefined);
    if (fileWritten) await unlink(absolutePath).catch(() => undefined);
    return Response.json({ error: "Could not store the media. Check the media directory and MariaDB." }, { status: 500 });
  } finally { connection.release(); }
}
