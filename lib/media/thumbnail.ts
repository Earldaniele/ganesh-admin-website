import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaRoot } from "./library.ts";

const pending = new Map<string, Promise<Buffer>>();
/** Derivatives stay outside public/. Callers must authorize every read. */
export function thumbnail(id: string, storage: string): Promise<Buffer> {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^content\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp|svg|avif|gif|ico)$/i.test(storage)) return Promise.reject(new Error("Unsupported thumbnail"));
  const key = `${mediaRoot()}:${id}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const original = path.join(mediaRoot(), storage);
    await stat(original); // A cached derivative must not hide a missing original.
    const directory = path.join(mediaRoot(), "thumbnails"), file = path.join(directory, `${id}.webp`);
    try { return await readFile(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const bytes = await sharp(original, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 384, height: 288, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    await mkdir(directory, { recursive: true });
    await writeFile(file, bytes);
    return bytes;
  })().finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
