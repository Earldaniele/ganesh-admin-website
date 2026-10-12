// Fixture-only browser verification. No account or database writes.
/* eslint-disable @typescript-eslint/no-explicit-any -- Playwright is loaded from the workstation's external QA runtime. */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import "./environment.ts";
import { createEditorPreviewSession } from "../lib/preview-ticket.ts";
import { initialContent } from "../lib/content/seed.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
let draft = structuredClone(initialContent);
let version = 1;
const session = createEditorPreviewSession();
const errors: string[] = [];
const qaDirectory = new URL("../app/fabric-editor-qa/", import.meta.url);
const qaPage = new URL("page.tsx", qaDirectory);
let createdQaPage = false;
try {
  await mkdir(qaDirectory, { recursive: true });
  await writeFile(qaPage, '"use client";\nexport { default } from "@/components/VisualEditor";\n', { flag: "wx" });
  createdQaPage = true;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/api/auth/me", (route: any) => route.fulfill({ json: { permissions: { publish: true } } }));
  await context.route("**/api/editor-preview", (route: any) => route.fulfill({ json: session }));
  await context.route("**/api/content", async (route: any) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON(); assert.equal(body.version, version);
      draft = contentSnapshotSchema.parse(body.content); version++;
      await route.fulfill({ json: { ok: true, version } });
    } else await route.fulfill({ json: { content: draft, version } });
  });
  await context.route("**/api/media", (route: any) => route.fulfill({ json: { src: "http://localhost:3001/media/content/11111111-1111-4111-8111-111111111111.webp", assetId: "11111111-1111-4111-8111-111111111111" } }));
  await context.route("**/media/content/11111111-1111-4111-8111-111111111111.webp", async (route: any) => route.fulfill({ contentType: "image/webp", body: await readFile("../ganesh-website/public/images/fabrics/aircool.webp") }));
  const page = await context.newPage(); page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.goto("http://localhost:3001/fabric-editor-qa", { waitUntil: "networkidle", timeout: 60000 });
  console.log("QA editor loaded");
  const preview = page.frameLocator('iframe[title="Ganesh website visual preview"]');
  await preview.locator("#fabrics").scrollIntoViewIfNeeded({ timeout: 60000 }).catch(async (error: Error) => {
    console.log("Editor state:", (await page.locator("body").innerText()).slice(-1800));
    for (const frame of page.frames()) if (frame !== page.mainFrame()) console.log("Preview state:", (await frame.locator("body").innerText()).slice(0, 1200));
    throw error;
  });
  await preview.getByRole("button", { name: "Add Category", exact: true }).waitFor({ timeout: 60000 });
  await preview.getByRole("button", { name: "Add Category", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Edit content panel" });
  await panel.getByLabel("Name", { exact: true }).fill("QA empty category");
  await panel.getByRole("button", { name: "Apply changes", exact: true }).click();
  console.log("QA category applied");
  await preview.locator("#fabric-category-title").filter({ hasText: "QA empty category" }).waitFor();
  assert.equal(await preview.locator(".fabric-explorer__card").count(), 0);
  await preview.getByRole("button", { name: "Add Public", exact: true }).click();
  await panel.locator('details[open]').getByLabel("Name", { exact: true }).fill("QA public card");
  await panel.locator('details[open]').getByLabel("Description", { exact: true }).fill("Full details for QA");
  await panel.locator('details[open]').getByLabel("Short Description", { exact: true }).fill("Short card details");
  await panel.locator('input[type="file"]').setInputFiles({ name: "fabric.webp", mimeType: "image/webp", buffer: await readFile("../ganesh-website/public/images/fabrics/aircool.webp") });
  await page.getByRole("dialog").getByLabel("Required image description / Alt text").fill("QA fabric swatch");
  await page.getByRole("button", { name: "Upload and use image" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await panel.getByRole("button", { name: "Apply changes", exact: true }).click();
  await preview.locator(".fabric-explorer__card-name").filter({ hasText: "QA public card" }).waitFor().catch(async (error: Error) => {
    console.log("Runtime errors:", errors);
    console.log("Card apply state:", (await page.locator("body").innerText()).slice(-2400));
    console.log("Preview state:", await preview.locator("body").innerText());
    throw error;
  });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await page.getByText("Private draft saved.", { exact: true }).waitFor();
  const category = draft.fabricCategories!.find((item) => item.name === "QA empty category")!;
  assert.ok(category);
  assert.equal(draft.fabrics.filter((item) => item.categoryId === category.id).length, 1);
  assert.deepEqual(draft.fabrics.slice(0, initialContent.fabrics.length), initialContent.fabrics);
  assert.equal(draft.fabrics.at(-1)!.image.assetId, "11111111-1111-4111-8111-111111111111");
  await page.reload({ waitUntil: "networkidle" });
  await preview.locator("#fabrics").scrollIntoViewIfNeeded();
  await preview.locator(".fabric-explorer__category").filter({ hasText: "QA empty category" }).click();
  await preview.locator(".fabric-explorer__card-name").filter({ hasText: "QA public card" }).waitFor();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await preview.locator(".fabric-explorer__card").click();
  await preview.getByRole("dialog").getByText("Full details for QA", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await preview.getByRole("dialog").waitFor({ state: "hidden" });
  await preview.locator(".fabric-explorer__category").filter({ hasText: "Aircool" }).click();
  await preview.locator("#fabric-category-title").filter({ hasText: "Aircool" }).waitFor();
  await preview.locator(".fabric-explorer__card-name").filter({ hasText: "QA public card" }).waitFor({ state: "detached" });
  assert.equal(await preview.locator(".fabric-explorer__card-name").filter({ hasText: "QA public card" }).count(), 0);
  await preview.locator(".fabric-explorer__category").filter({ hasText: "QA empty category" }).click();
  await preview.locator(".fabric-explorer__card-name").filter({ hasText: "QA public card" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await preview.locator("#fabrics").scrollIntoViewIfNeeded();
  await mkdir(".visual-qa/fabric-editor", { recursive: true });
  await page.screenshot({ path: ".visual-qa/fabric-editor/mobile.png" });
  const editedPageWidth = await preview.locator("html").evaluate((html: HTMLElement) => html.scrollWidth);
  assert.equal(await preview.locator("#fabrics").evaluate((section: HTMLElement) => section.scrollWidth > innerWidth), false);
  draft = structuredClone(initialContent);
  await page.reload({ waitUntil: "networkidle" });
  await preview.locator("#fabrics").scrollIntoViewIfNeeded();
  const baselinePageWidth = await preview.locator("html").evaluate((html: HTMLElement) => html.scrollWidth);
  assert.ok(editedPageWidth <= baselinePageWidth, "New catalog content increased page overflow");
  console.log(`Mobile full-page widths: edited ${editedPageWidth}, baseline ${baselinePageWidth}; Fabrics fits the viewport.`);
  assert.deepEqual(errors, []);
  console.log("PASS: category creation, empty state, selected-category card + upload controls, schema-validated fixture save/reload, details, category isolation, mobile bounds; no database writes.");
} finally {
  await browser.close();
  if (createdQaPage) { await unlink(qaPage); await rmdir(qaDirectory); }
}
