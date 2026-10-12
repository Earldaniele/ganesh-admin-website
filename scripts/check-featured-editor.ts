// Local integration test: temporary QA identity, actual media API and draft writes.
// Restores the original draft using optimistic concurrency; never publishes.
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { scriptDatabase } from "./environment.ts";
import { hashPassword } from "../lib/auth/password.ts";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const pool = scriptDatabase();
const id = randomUUID(); const email = `featured-qa-${id}@example.invalid`; const password = randomBytes(24).toString("base64url");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const origin = "http://localhost:3001";
let original: any; let lastSavedVersion: number | undefined;
try {
  await pool.execute("INSERT INTO admin_profiles (id,email,display_name,password_hash,role) VALUES (?,?,'Featured upload QA',?,'editor')", [id,email,await hashPassword(password)]);
  const login = await context.request.post(`${origin}/api/auth/login`, { headers: { origin }, data: { email, password } });
  assert.equal(login.status(), 200, "QA login failed");
  original = await (await context.request.get(`${origin}/api/content`)).json();
  const publication = await (await context.request.get(`${origin}/api/public-content`)).text();
  await mkdir(".visual-qa/featured", { recursive: true });
  await writeFile(".visual-qa/featured/original-draft.json", JSON.stringify(original));
  const page = await context.newPage(); const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto(`${origin}/editor`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Edit Featured products · video & gallery", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Edit content panel" });
  await panel.getByLabel("Name", { exact: true }).fill("Full Sublimation Jersey QA");
  await panel.locator(".ve-featured-editor").getByLabel("Description", { exact: true }).fill("Persistent featured jersey description QA");
  const videoBytes = await readFile("../ganesh-website/public/videos/featured/jersey.mp4");
  const videoRequest = page.waitForResponse((r: any) => r.url().endsWith("/api/media") && r.request().method() === "POST");
  await panel.locator('input[type="file"][accept="video/mp4"]').setInputFiles({ name: "jersey.mp4", mimeType: "video/mp4", buffer: videoBytes });
  const uploadedVideo = await (await videoRequest).json(); assert.ok(uploadedVideo.assetId, JSON.stringify(uploadedVideo));
  await panel.getByText("Video uploaded. Save Changes to keep this selection.").waitFor();
  const storedVideo = await context.request.get(uploadedVideo.src); assert.equal(storedVideo.status(), 200);
  assert.deepEqual(await storedVideo.body(), videoBytes, "Audio/video bytes must remain unchanged");
  const range = await context.request.get(uploadedVideo.src, { headers: { range: "bytes=0-99" } }); assert.equal(range.status(),206); assert.equal((await range.body()).length,100);
  assert.equal(await panel.locator("video").evaluate((v: HTMLVideoElement) => v.controls && !v.muted), true);
  const image = await readFile("public/images/work/sports-01.webp");
  await panel.locator('input[type="file"][multiple]').setInputFiles([{ name: "front.webp", mimeType: "image/webp", buffer: image }, { name: "back.webp", mimeType: "image/webp", buffer: image }]);
  await panel.getByText("2 images uploaded. Review their captions and alt text, then Save Changes.").waitFor();
  const cards = panel.locator(".ve-gallery-item");
  const baselineCount = original.content.featuredProducts[0].gallery.length;
  assert.equal(await cards.count(), baselineCount + 2);
  await cards.last().getByRole("button", { name: "Remove image", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove item", exact: true }).click();
  assert.equal(await cards.count(), baselineCount + 1);
  const replaceResponse = page.waitForResponse((r: any) => r.url().endsWith("/api/media"));
  await cards.first().locator('input[type="file"]').setInputFiles({ name: "replacement.webp", mimeType: "image/webp", buffer: image });
  await page.getByRole("dialog").getByLabel("Required image description / Alt text").fill("Replacement jersey photo");
  await page.getByRole("button", { name: "Upload and use image", exact: true }).click();
  assert.equal((await replaceResponse).status(),200);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const savedResponse = page.waitForResponse((r: any) => r.url().endsWith("/api/content") && r.request().method() === "PUT");
  await panel.getByRole("button", { name: "Save Changes", exact: true }).click();
  const saved = await (await savedResponse).json(); assert.equal(saved.ok,true,JSON.stringify(saved)); lastSavedVersion=saved.version;
  await panel.waitFor({ state: "hidden" });
  const preview = page.frameLocator('iframe[title="Ganesh website visual preview"]');
  await preview.locator("#featured").getByRole("heading", { name: "Full Sublimation Jersey QA", exact: true }).waitFor({ timeout: 60000 });
  await preview.locator("#featured").getByText("Persistent featured jersey description QA", { exact: true }).waitFor();
  assert.equal(await preview.locator("#featured .featured-product__gallery button").count(), baselineCount + 1);
  const loaded = await (await context.request.get(`${origin}/api/content`)).json();
  const jersey = loaded.content.featuredProducts[0]; assert.equal(jersey.name,"Full Sublimation Jersey QA"); assert.equal(jersey.gallery.length,baselineCount+1); assert.equal(jersey.video.assetId,uploadedVideo.assetId);
  assert.deepEqual(loaded.content.featuredProducts.slice(1),original.content.featuredProducts.slice(1));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Edit Featured products · video & gallery", exact: true }).click();
  assert.equal(await panel.getByLabel("Name", { exact:true }).inputValue(),jersey.name);
  await panel.locator("video").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".visual-qa/featured/desktop.png" });
  await page.setViewportSize({ width:390,height:844 });
  await panel.locator("video").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".visual-qa/featured/mobile.png" });
  assert.equal(await panel.evaluate((p: HTMLElement) => p.scrollWidth > p.clientWidth),false);
  assert.equal(await (await context.request.get(`${origin}/api/public-content`)).text(),publication,"QA must not publish");
  const bad = await context.request.post(`${origin}/api/media`,{headers:{origin},multipart:{file:{name:"fake.mp4",mimeType:"video/mp4",buffer:Buffer.from("bad")},alt:"Invalid video"}});assert.equal(bad.status(),415);
  assert.deepEqual(errors,[]);
  console.log("PASS: real uploads, unchanged MP4/audio bytes, byte ranges, multi-image add/replace/remove, text save/reload, other-product preservation, mobile layout, and invalid MP4 rejection. Public publication unchanged.");
} finally {
  if (lastSavedVersion !== undefined) {
    const restored = await context.request.put(`${origin}/api/content`,{headers:{origin},data:{content:original.content,version:lastSavedVersion}});
    assert.equal(restored.status(),200,"Draft changed concurrently; restore backup manually instead of overwriting another save.");
    console.log("PASS: original draft restored at a new version.");
  }
  await pool.execute("DELETE FROM admin_profiles WHERE id=?",[id]);
  await pool.end(); await browser.close();
}
