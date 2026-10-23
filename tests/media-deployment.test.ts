import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import { collectMediaSources, mediaUrlKey } from "../lib/content/media-references.ts";
import { syncExistingMedia } from "../lib/media/library.ts";
import { refreshMedia } from "../lib/media/refresh.ts";

test("sync preserves imported localhost media after a production domain change, including deleted entries", async () => {
  const origins = ["https://admin.example.com", "https://example.com"];
  const content = await Promise.all(["initial-content.json", "current-design.json"].map(async (name) =>
    JSON.parse(await readFile(path.join(process.cwd(), "lib/content", name), "utf8"))));
  const sourceKeys = new Set(content.flatMap((snapshot) => collectMediaSources(snapshot).map(({ src }) => mediaUrlKey(src, origins))));
  sourceKeys.add("/images/work/events-02.webp");
  const rows = [...sourceKeys].map((key) => ({
    id: randomUUID(), storage_path: `content/${randomUUID()}.webp`,
    source_url: new URL(key, "http://localhost:3000").href,
    source_key: createHash("sha256").update(key).digest("hex"), deleted_at: "2026-10-01",
  }));
  let insertAttempts = 0, released = false;
  const connection = {
    async query(sql: string) {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }]];
      if (sql === "SELECT * FROM media_assets") return [rows];
      if (sql.includes("FROM site_drafts")) return [[{ site_key: "ganesh-main", version: 1,
        content: { image: { src: "/images/work/events-02.webp", alt: "Existing photo" } } }]];
      if (sql.includes("FROM site_publications") || sql.includes("FROM content_revision_history") || sql.includes("FROM saved_editor_drafts")) return [[]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute() { insertAttempts++; throw new Error("Duplicate source_key would fail the production sync"); },
    release() { released = true; },
  };
  const pool = { async getConnection() { return connection; } } as unknown as Pool;
  const previous = { repo: process.env.PUBLIC_REPO_PATH, public: process.env.PUBLIC_SITE_ORIGIN, media: process.env.CMS_MEDIA_ORIGIN };
  const directory = await mkdtemp(path.join(tmpdir(), "ganesh-media-deployment-"));
  try {
    process.env.PUBLIC_REPO_PATH = directory; // Separate deployments have no sibling public checkout.
    process.env.PUBLIC_SITE_ORIGIN = origins[1];
    process.env.CMS_MEDIA_ORIGIN = origins[0];
    const before = JSON.stringify(rows);
    assert.equal(await syncExistingMedia(pool, origins[0]), 0);
    assert.equal(await syncExistingMedia(pool, origins[0]), 0, "retries remain idempotent");
    assert.equal(insertAttempts, 0);
    assert.equal(JSON.stringify(rows), before, "existing records and deletion history remain unchanged");
    assert.equal(released, true);
  } finally {
    for (const [key, value] of [["PUBLIC_REPO_PATH", previous.repo], ["PUBLIC_SITE_ORIGIN", previous.public], ["CMS_MEDIA_ORIGIN", previous.media]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failed sync still loads saved media and reports the sync error", async () => {
  let visibleMedia: string[] = [];
  const syncError = new Error("Existing media sync failed");
  await assert.rejects(refreshMedia(async () => { throw syncError; }, async () => {
    visibleMedia = ["existing-photo.webp", "existing-video.mp4"];
  }), (error) => error === syncError);
  assert.deepEqual(visibleMedia, ["existing-photo.webp", "existing-video.mp4"]);
});

test("a library load error takes precedence when both operations fail", async () => {
  const loadError = new Error("Cannot load saved media");
  await assert.rejects(refreshMedia(async () => { throw new Error("Sync failed"); }, async () => {
    throw loadError;
  }), (error) => error === loadError);
});
