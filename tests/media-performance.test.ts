import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import sharp from "sharp";
import { listMedia } from "../lib/media/library.ts";
import { thumbnail } from "../lib/media/thumbnail.ts";
import { privateMediaLinks, PreviewMediaLoader } from "../lib/media/preview.ts";

test("listing is bounded and searches literal patterns without reading history", async () => {
  const queries: { sql: string; values: unknown[] }[] = [];
  const pool = { async query(sql: string, values: unknown[]) {
    queries.push({ sql, values });
    assert.match(sql, /FROM media_assets/);
    return sql.includes("COUNT") ? [[{ total: 203 }]] : [[]];
  } } as unknown as Pool;
  const result = await listMedia(pool, "https://admin.example", { search: "50%_off=", type: "image", page: 2, pageSize: 999 });
  assert.equal(result.total, 203); assert.equal(result.pageSize, 100);
  assert.deepEqual(queries[1].values, ["image/%", "%50=%=_off==%", "%50=%=_off==%", "%50=%=_off==%", 100, 100]);
  assert.equal(queries.length, 2);
});

test("private preview requests cannot target unrelated origins or malformed URLs", () => {
  const links = privateMediaLinks({ images: [{ src: "/media/content/a.png" }, { src: "https://other.example/media/content/b.png" }, { src: "http://[" }, { src: "/images/public.png" }] }, "https://admin.example");
  assert.deepEqual([...links], [["/media/content/a.png", "https://admin.example/media/content/a.png"]]);
});

test("preview queue deduplicates, bounds concurrency, aborts obsolete work and reuses bytes", async () => {
  let reads = 0;
  const complete = new Map<string, (data: string) => void>();
  const loader = new PreviewMediaLoader((src, signal) => new Promise((resolve, reject) => {
    reads++; complete.set(src, resolve);
    signal.addEventListener("abort", () => reject(new DOMException("Obsolete", "AbortError")));
  }), 1);
  const first = loader.load("old"); assert.equal(loader.load("old"), first);
  const cancelled = assert.rejects(first, { name: "AbortError" });
  const queued = loader.load("queued"); const cancelledQueue = assert.rejects(queued, { name: "AbortError" });
  assert.equal(reads, 1);
  loader.retain(new Set(["new"]));
  const latest = loader.load("new");
  await cancelled; await cancelledQueue;
  complete.get("new")!("data:image/png;base64,new");
  assert.equal(await latest, "data:image/png;base64,new");
  assert.equal(await loader.load("new"), await latest); assert.equal(reads, 2);
});

test("thumbnails are bounded private derivatives; missing originals and traversal fail", async () => {
  const previous = process.env.CMS_MEDIA_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "ganesh-thumbnails-"));
  process.env.CMS_MEDIA_DIR = directory;
  try {
    const id = randomUUID(), storage = `content/${id}.png`, file = path.join(directory, storage);
    await mkdir(path.dirname(file));
    await writeFile(file, await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#ab1730" } }).png().toBuffer());
    const first = thumbnail(id, storage); assert.equal(thumbnail(id, storage), first);
    const info = await sharp(await first).metadata();
    assert.equal(info.width, 384); assert.equal(info.height, 288); assert.equal(info.format, "webp");
    await unlink(file);
    await assert.rejects(thumbnail(id, storage), { code: "ENOENT" });
    await assert.rejects(thumbnail(id, "../other.png"));
  } finally {
    if (previous === undefined) delete process.env.CMS_MEDIA_DIR; else process.env.CMS_MEDIA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
