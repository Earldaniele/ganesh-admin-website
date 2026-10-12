import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { syncCurrentDesign } from "../lib/content/sync-design.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
import { validateVideo } from "../lib/media/validate.ts";

test("draft design import preserves private fields, deleted items and custom ordering, and is repeatable", async () => {
  const original = JSON.parse(await readFile("lib/content/initial-content.json", "utf8"));
  original.pages.home.hero.copy = "Existing private draft";
  original.products.reverse(); original.products[0].name = "Private product name";
  original.fabrics[0].image.src = "/my-existing-draft.webp";
  const next = syncCurrentDesign(original);
  assert.equal(next.pages.home.hero.copy, "Existing private draft");
  assert.deepEqual(next.products.map((p) => p.id), original.products.map((p: {id: string}) => p.id));
  assert.equal(next.products[0].name, "Private product name");
  assert.equal(next.fabrics[0].image.src, "/my-existing-draft.webp");
  assert.ok(next.fabrics[0].recommendedUses?.length);
  assert.equal(next.featuredProducts?.length, 3);
  assert.deepEqual(syncCurrentDesign(next), next);
});
test("video and gallery fields survive serialization; invalid media URLs and empty galleries fail validation", async () => {
  const snapshot = syncCurrentDesign(JSON.parse(await readFile("lib/content/initial-content.json", "utf8")));
  assert.deepEqual(contentSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot))), snapshot);
  snapshot.featuredProducts![0].video.src = "javascript:alert(1)";
  assert.equal(contentSnapshotSchema.safeParse(snapshot).success, false);
  snapshot.featuredProducts![0].video.src = "";
  snapshot.featuredProducts![0].gallery = [];
  assert.equal(contentSnapshotSchema.safeParse(snapshot).success, false);
});
test("MP4 upload validation accepts actual source videos and rejects truncated or disguised files", async () => {
  const video = await readFile("../ganesh-website/public/videos/featured/jersey.mp4");
  assert.equal(validateVideo(video, "video/mp4").mime, "video/mp4");
  assert.throws(() => validateVideo(video.subarray(0, 32), "video/mp4"));
  assert.throws(() => validateVideo(Buffer.from("<script>alert(1)</script>"), "video/mp4"));
  assert.throws(() => validateVideo(video, "image/png"));
});
