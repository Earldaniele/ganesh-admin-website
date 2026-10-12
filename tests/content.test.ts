import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initialContent } from "../lib/content/seed.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
import { collectMediaIds } from "../lib/content/media-references.ts";
import { extendSnapshot } from "../lib/content/extend-snapshot.ts";
import { validateOrderBuilderConfig } from "../lib/content/validation.ts";

test("the public fixture is a complete validated snapshot", () => {
  const content = contentSnapshotSchema.parse(initialContent);
  assert.equal(content.products.length, 8); assert.equal(content.fabrics.length, 5);
  assert.notEqual(content.products[0].details, content.products[0].shortDescription);
});
test("duplicate IDs, duplicate slugs and missing references are rejected", () => {
  for (const change of [(c: typeof initialContent) => c.products.push(c.products[0]), (c: typeof initialContent) => { c.products[1].slug = c.products[0].slug; }, (c: typeof initialContent) => c.products.shift()]) {
    const content = structuredClone(initialContent); change(content); assert.equal(contentSnapshotSchema.safeParse(content).success, false);
  }
});
test("dangerous URLs, nested HTML fields and empty required interactive collections are rejected", () => {
  for (const change of [(c: typeof initialContent) => { c.pages.home.hero.primary.href = "javascript:alert(1)"; }, (c: typeof initialContent) => { c.fabrics[0].image.src = "data:text/html,hi"; }, (c: typeof initialContent) => { c.fabrics.forEach((f) => { f.active = false; }); }]) {
    const content = structuredClone(initialContent); change(content); assert.equal(contentSnapshotSchema.safeParse(content).success, false);
  }
  const copy = structuredClone(initialContent) as unknown as Record<string, unknown>;
  copy.pages = { ...initialContent.pages, products: { html: { __html: "<script>bad</script>" } } };
  assert.equal(contentSnapshotSchema.safeParse(copy).success, false);
});
test("media reference collection is recursive and deduplicated", () => {
  assert.deepEqual(collectMediaIds({ image: { assetId: "one" }, tiles: [{ image: { assetId: "one" } }, { image: { assetId: "two" } }] }), ["one", "two"]);
});
test("public adapter renders only opted-in publications and handles new media fields", async () => {
  const website = await readFile("../ganesh-website/components/cms/CmsContent.tsx", "utf8");
  assert.match(website, /editorIntegrationVersion === 2/);
  assert.match(website, /case "featuredProducts"/);
  assert.match(website, /case "catalogFabrics"/);
});

test("additive migration is idempotent and preserves draft edits and IDs", () => {
  const old = structuredClone(initialContent);
  delete old.editorial;
  delete old.pages.products!.nextHeading;
  old.pages.home.hero.copy = "Private editor change";
  old.pages.products!.heroLead = "Customized interior copy";
  const next = extendSnapshot(old);
  assert.equal(next.pages.home.hero.copy, "Private editor change");
  assert.equal(next.pages.products!.heroLead, "Customized interior copy");
  assert.equal(next.products[0].id, old.products[0].id);
  assert.ok(next.editorial?.images.productionHero.alt);
  assert.equal(next.pages.products!.nextHeading, initialContent.pages.products!.nextHeading);
  assert.deepEqual(extendSnapshot(next), next);
});

test("current source fixture includes featured videos and latest fabric details", () => {
  const fixture = contentSnapshotSchema.parse(initialContent);
  assert.equal(fixture.featuredProducts?.length, 3);
  assert.equal(fixture.featuredProducts?.[0].video.src, "/videos/featured/jersey.mp4");
  assert.equal(fixture.featuredProducts?.[0].gallery.length, 4);
  assert.ok(fixture.fabrics[0].benefits?.length);
});

test("new production links reject script URLs and blank image descriptions", () => {
  const bad = structuredClone(initialContent);
  bad.editorial!.productionPreparation[0].href = "javascript:alert(1)";
  assert.equal(contentSnapshotSchema.safeParse(bad).success, false);
  bad.editorial!.productionPreparation[0].href = "/products";
  bad.editorial!.images.productionHero.alt = "";
  assert.equal(contentSnapshotSchema.safeParse(bad).success, false);
});

test("order builder options reject blank, duplicate and invalid default values", () => {
  const config = structuredClone(initialContent.orderBuilder);
  assert.deepEqual(validateOrderBuilderConfig(config), []);
  config.customizationOptions.push("  ");
  assert.match(validateOrderBuilderConfig(config).join(" "), /blank/);
  config.customizationOptions.pop();
  config.sizingOptions.push("Kids");
  assert.match(validateOrderBuilderConfig(config).join(" "), /duplicates/);
  config.sizingOptions.pop();
  config.defaultSizing = "Removed option";
  assert.match(validateOrderBuilderConfig(config).join(" "), /Default sizing/);
});
