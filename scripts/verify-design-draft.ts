import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import type { RowDataPacket } from "mysql2/promise";
import { scriptDatabase } from "./environment.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
const pool = scriptDatabase();
try {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT content, version FROM site_drafts WHERE site_key = 'ganesh-main'");
  const draft = contentSnapshotSchema.parse(typeof rows[0].content === "string" ? JSON.parse(rows[0].content) : rows[0].content);
  const [imports] = await pool.query<RowDataPacket[]>("SELECT backup_path, draft_version FROM editor_design_imports WHERE site_key = 'ganesh-main' ORDER BY id DESC LIMIT 1");
  const backup = JSON.parse(await readFile(imports[0].backup_path, "utf8"));
  const before = typeof backup.content === "string" ? JSON.parse(backup.content) : backup.content;
  assert.deepEqual(draft.products, before.products);
  assert.deepEqual(draft.pages.home, before.pages.home);
  assert.deepEqual(draft.global, before.global);
  assert.equal(draft.featuredProducts?.length, 3);
  assert.ok(draft.fabrics.filter((f) => ["aircool", "lacoste", "polydex", "drifit", "microshine"].includes(f.id)).every((f) => f.shortDescription && f.benefits.length && f.recommendedUses.length));
  assert.ok(draft.designCopy?.FabricExplorer);
  const [publication] = await pool.query<RowDataPacket[]>("SELECT version, published_at FROM site_publications WHERE site_key = 'ganesh-main'");
  const report = { draftVersion: rows[0].version, importedDraftVersion: imports[0].draft_version, featuredProducts: draft.featuredProducts?.length, videoFields: draft.featuredProducts?.map((p) => Boolean(p.video.src)), existingProductsHomeAndGlobalPreserved: true, publicationVersion: publication[0].version, publicationDate: publication[0].published_at, verificationWrites: false };
  await writeFile(".visual-qa/visual-editor/database-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await pool.end(); }
