// Local, read-only database comparison of the previous listing algorithm and
// the paginated listing on one unchanged media/history dataset.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { scriptDatabase } from "./environment.ts";
import { libraryItem, listMedia, snapshots, usagesFor } from "../lib/media/library.ts";
import type { DbRow } from "../lib/mysql/db.ts";
const pool = scriptDatabase(), origin = process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001";
const fingerprint = async () => {
  const [rows] = await pool.query("SELECT * FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at DESC, id") as unknown as [DbRow[], unknown];
  const content = await snapshots(pool);
  return { hash: createHash("sha256").update(JSON.stringify({ rows, content })).digest("hex"), assets: rows.length, snapshots: content.length };
};
try {
  const beforeDataset = await fingerprint();
  async function legacyList() {
    const [rows] = await pool.query("SELECT * FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at DESC, id") as unknown as [DbRow[], unknown];
    const content = await snapshots(pool);
    return { media: rows.map(row => {
      const item = libraryItem(row, origin);
      delete item.thumbnail;
      return { ...item, usages: usagesFor(row, content, origin) };
    }) };
  }
  async function measure(load: () => Promise<unknown>) {
    const milliseconds: number[] = []; let bytes = 0;
    for (let index = 0; index < 5; index++) {
      const start = performance.now(), result = await load();
      milliseconds.push(performance.now() - start); bytes = Buffer.byteLength(JSON.stringify(result));
    }
    return { milliseconds, medianMs: [...milliseconds].sort((a, b) => a - b)[2], responseBytes: bytes };
  }
  const before = await measure(legacyList), after = await measure(() => listMedia(pool, origin));
  const afterDataset = await fingerprint();
  if (beforeDataset.hash !== afterDataset.hash) throw new Error("Dataset changed during benchmark. Repeat without concurrent content/media changes.");
  const result = { environment: "local MariaDB; server functions, not deployed HTTP or browser paint", dataset: beforeDataset, before, after };
  await mkdir(".visual-qa/performance", { recursive: true });
  await writeFile(".visual-qa/performance/comparison.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await pool.end(); }
