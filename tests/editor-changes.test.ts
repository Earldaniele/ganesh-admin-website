import { test } from "node:test";
import assert from "node:assert/strict";
import { contentChanges, sameContent, undoContentChange, workingPreview, reconcileEditorCopy } from "../lib/editor-changes.ts";
import { initialContent } from "../lib/content/seed.ts";
import { reconcileCopyAliases } from "../lib/content/copy-aliases.ts";
import { snapshots, usagesFor } from "../lib/media/library.ts";
import type { Pool } from "mysql2/promise";

test("field counting ignores keystrokes and removes reverted values", () => {
  const base = structuredClone(initialContent), working = structuredClone(base);
  for (const text of ["A", "An", "An edited heading"]) {
    working.pages.home.hero.eyebrow = text;
    assert.equal(contentChanges(base, working).length, 1);
  }
  working.pages.home.hero.eyebrow = base.pages.home.hero.eyebrow;
  assert.equal(contentChanges(base, working).length, 0);
  assert.equal(sameContent({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test("temporarily incomplete image links do not break live typing or mutate working edits", () => {
  const previous = { heading: "Before", image: { src: "/photo.webp", alt: "Photo" } };
  for (const src of ["", "http://", "javascript:alert(1)", "//untrusted.example/image"]) {
    const working = { heading: "Typing live", image: { src, alt: "Updated description" } };
    const preview = workingPreview(working, previous);
    assert.equal(preview.heading, "Typing live");
    assert.equal(preview.image.src, previous.image.src);
    assert.equal(preview.image.alt, "Updated description");
    assert.equal(working.image.src, src);
  }
});

test("separate menu labels count as separate fields even without record IDs", () => {
  const base = structuredClone(initialContent), working = structuredClone(base);
  working.global.nav[0].label = "First menu edit";
  working.global.nav[1].label = "Second menu edit";
  const changes = contentChanges(base, working);
  assert.equal(changes.length, 2);
  assert.deepEqual(changes.reduce((v, c) => undoContentChange(v, c), working), base);
});

test("changes are grouped by page and section and contain before/after values", () => {
  const working = structuredClone(initialContent);
  working.pages.home.hero.eyebrow = "Home draft";
  working.pages.products!.heroLead = "Products draft";
  working.global.businessName = "Business draft";
  const changes = contentChanges(initialContent, working);
  assert.equal(changes.length, 3);
  assert.equal(changes.find(c => c.path === "pages.home.hero.eyebrow")?.page, "Home");
  assert.equal(changes.find(c => c.path === "pages.products.heroLead")?.page, "Products");
  const shared = changes.find(c => c.path === "global.businessName")!;
  assert.equal(shared.page, "Shared website");
  assert.equal(shared.before, initialContent.global.businessName);
  assert.equal(shared.after, "Business draft");
});

test("undoing one field preserves changes to another field and does not mutate inputs", () => {
  const working = structuredClone(initialContent);
  working.products[0].name = "Draft product";
  working.products[1].details = "Draft details";
  const change = contentChanges(initialContent, working).find(c => c.path === "products.0.name")!;
  const undone = undoContentChange(working, change);
  assert.equal(undone.products[0].name, initialContent.products[0].name);
  assert.equal(undone.products[1].details, "Draft details");
  assert.equal(working.products[0].name, "Draft product");
});

test("keyed additions and deletions are explicit and do not count shifted siblings", () => {
  const before = { products: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
  const after = { products: [{ id: "b", name: "B" }, { id: "c", name: "C" }] };
  const changes = contentChanges(before, after);
  assert.deepEqual(changes.map(c => c.kind).sort(), ["added", "deleted"]);
  const restored = changes.reduce((value, change) => undoContentChange(value, change), after);
  assert.deepEqual(restored, before);
});

test("multiple deletions restore their original position in either undo order", () => {
  const before = { products: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  const after = { products: [{ id: "c" }] };
  const changes = contentChanges(before, after);
  for (const ordered of [changes, [...changes].reverse()]) assert.deepEqual(ordered.reduce((v, c) => undoContentChange(v, c), after), before);
});

test("derived order metadata does not inflate reorder or deletion counts", () => {
  const before = { products: [{ id: "a", order: 0 }, { id: "b", order: 1 }, { id: "c", order: 2 }] };
  const reordered = { products: [{ id: "c", order: 0 }, { id: "a", order: 1 }, { id: "b", order: 2 }] };
  const changes = contentChanges(before, reordered);
  assert.equal(changes.length, 1);
  assert.deepEqual(undoContentChange(reordered, changes[0]), before);
  const deleted = { products: [{ id: "b", order: 0 }, { id: "c", order: 1 }] };
  const removals = contentChanges(before, deleted);
  assert.equal(removals.length, 1);
  assert.deepEqual(undoContentChange(deleted, removals[0]), before);
});

test("a field undo follows record identity after reordering", () => {
  const before = { products: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
  const after = { products: [{ id: "b", name: "Edited B" }, { id: "a", name: "A" }] };
  const changes = contentChanges(before, after);
  const edit = changes.find(c => c.path.endsWith(".name"))!;
  const undone = undoContentChange(after, edit);
  assert.deepEqual(undone.products, [{ id: "b", name: "B" }, { id: "a", name: "A" }]);
  assert.deepEqual(undoContentChange(undone, changes.find(c => c.path.endsWith(".$order"))!), before);
});

test("image selection is one field and undo restores its asset identity without undoing alt text", () => {
  const base = { image: { src: "/old.webp", assetId: "old", alt: "Old" } };
  const working = { image: { src: "/new.webp", assetId: "new", alt: "Edited description" } };
  const changes = contentChanges(base, working);
  assert.equal(changes.length, 2);
  const undone = undoContentChange(working, changes.find(c => c.path.endsWith(".src"))!);
  assert.deepEqual(undone.image, { src: "/old.webp", assetId: "old", alt: "Edited description" });
  const noId = { image: { src: "/old.webp", alt: "Old" } };
  assert.deepEqual(undoContentChange(working, contentChanges(noId, working).find(c => c.path.endsWith(".src"))!).image, { src: "/old.webp", alt: "Edited description" });
});

test("linked copy controls count once and undo restores even different original aliases", () => {
  const base = structuredClone(initialContent), submitted = structuredClone(base);
  submitted.global.quoteLabel = "New quote text";
  const working = reconcileCopyAliases(base, submitted).content;
  const changes = contentChanges(base, working);
  assert.equal(changes.length, 1);
  assert.deepEqual(undoContentChange(working, changes[0]), base);
});

test("typing a linked field back to its original value removes its count and restores original aliases", () => {
  const base = structuredClone(initialContent);
  base.global.quoteLabel = "Original compatibility text";
  const submitted = structuredClone(base);
  submitted.global.quoteLabel = "Typed text";
  const edited = reconcileEditorCopy(base, submitted, base);
  assert.equal(contentChanges(base, edited).length, 1);
  const reverted = structuredClone(edited);
  reverted.global.quoteLabel = base.global.quoteLabel;
  assert.deepEqual(reconcileEditorCopy(edited, reverted, base), base);
  assert.equal(contentChanges(base, reconcileEditorCopy(edited, reverted, base)).length, 0);
});

test("saved status is independent from pending changes against the original", () => {
  const base = { heading: "Original" }, draft = { heading: "Saved edit" };
  const saved = structuredClone(draft), working = structuredClone(draft);
  assert.equal(sameContent(working, saved), true);
  assert.equal(contentChanges(base, working).length, 1);
  working.heading = "New unsaved edit";
  assert.equal(sameContent(working, saved), false);
  assert.equal(contentChanges(base, working).length, 1);
});

test("media used only by a saved draft or its before image remains referenced", async () => {
  const db = { query: async (sql: string) => [sql.includes("FROM saved_editor_drafts") ? [{ name: "Private alternative", content: JSON.stringify({ image: { src: "/media/content/new.webp" } }), base_content: JSON.stringify({ image: { src: "/media/content/old.webp" } }) }] : []] } as unknown as Pool;
  const content = await snapshots(db);
  for (const file of ["old.webp", "new.webp"]) {
    const usages = usagesFor({ id: file, storage_path: `content/${file}` }, content, "http://localhost:3001");
    assert.ok(usages.some(u => u.location.includes("Private alternative")));
    assert.equal(usages[0].kind, "changes");
  }
});
