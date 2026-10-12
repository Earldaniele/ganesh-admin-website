import { test } from "node:test";
import assert from "node:assert/strict";
import { fabricCategories, newFabricCategory, newFabricCard } from "../lib/fabric-catalog.ts";
import { initialContent } from "../lib/content/seed.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
import { collectMediaIds } from "../lib/content/media-references.ts";

test("legacy fabrics retain their categories; new empty categories survive saving", () => {
  const original = structuredClone(initialContent);
  const categories = fabricCategories(original);
  assert.deepEqual(categories.map((item) => item.id), original.fabrics.map((item) => item.id));
  const next = contentSnapshotSchema.parse({ ...original, fabricCategories: [...categories, newFabricCategory(categories.length, "new-category")] });
  const saved = contentSnapshotSchema.parse(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(saved.fabrics, original.fabrics);
  assert.equal(saved.fabricCategories?.at(-1)?.id, "new-category");
  assert.equal(saved.fabrics.filter((item) => item.categoryId === "new-category").length, 0);
});

test("multiple cards stay in their selected category with details and persistent image references", () => {
  const content = structuredClone(initialContent);
  content.fabricCategories = [...fabricCategories(content), newFabricCategory(5, "new-category"), newFabricCategory(6, "other-category")];
  const first = newFabricCard("new-category", content.fabrics.length, "first-card");
  first.name = "First public"; first.description = "Full details"; first.shortDescription = "Card description";
  first.benefits = ["Breathable"]; first.recommendedUses = ["Uniforms"];
  first.image = { src: "/media/content/11111111-1111-4111-8111-111111111111.webp", alt: "Fabric swatch", assetId: "11111111-1111-4111-8111-111111111111", focalPoint: "30% 70%" };
  const second = { ...newFabricCard("new-category", content.fabrics.length + 1, "second-card"), image: content.fabrics[0].image };
  content.fabrics.push(first, second);
  const saved = contentSnapshotSchema.parse(JSON.parse(JSON.stringify(content)));
  assert.equal(saved.fabrics.filter((item) => item.categoryId === "new-category").length, 2);
  assert.equal(saved.fabrics.filter((item) => item.categoryId === "other-category").length, 0);
  assert.deepEqual(saved.fabrics.at(-2), first);
  assert.ok(collectMediaIds(saved).includes(first.image.assetId!));
});

test("new cards require a picture; missing category membership and duplicate categories fail validation", () => {
  const content = structuredClone(initialContent);
  content.fabricCategories = fabricCategories(content);
  const card = newFabricCard(content.fabricCategories[0].id, content.fabrics.length, "new-card");
  content.fabrics.push(card);
  assert.equal(contentSnapshotSchema.safeParse(content).success, false);
  card.image = { ...content.fabrics[0].image };
  assert.equal(contentSnapshotSchema.safeParse(content).success, true);
  card.categoryId = "missing-category";
  assert.equal(contentSnapshotSchema.safeParse(content).success, false);
  card.categoryId = content.fabricCategories[0].id;
  content.fabricCategories.push({ ...content.fabricCategories[0] });
  assert.equal(contentSnapshotSchema.safeParse(content).success, false);
});
