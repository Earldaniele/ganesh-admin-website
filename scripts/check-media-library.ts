// Integration test uses a temporary Editor identity and real MariaDB/storage.
// Restores its own draft edits with optimistic concurrency and never publishes.
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { scriptDatabase } from "./environment.ts";
import { hashPassword } from "../lib/auth/password.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const pool = scriptDatabase(), id = randomUUID(), email = `media-qa-${randomUUID()}@example.invalid`, password = randomBytes(24).toString("base64url");
const origin = process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(90000);
const http: any = Object.fromEntries(["get","post","put","delete"].map((method) => [method, (url: string, options: any = {}) => (context.request as any)[method](url, { timeout: 120000, ...options })]));
let original: any, version: number | undefined;
const uploaded: any[] = [];
try {
  assert.equal((await http.get(`${origin}/api/media`)).status(), 401);
  await pool.execute("INSERT INTO admin_profiles (id,email,display_name,password_hash,role) VALUES (?,?,'Media Library QA',?,'editor')", [id,email,await hashPassword(password)]);
  assert.equal((await http.post(`${origin}/api/auth/login`, { headers: { origin }, data: { email, password } })).status(), 200);
  original = await (await http.get(`${origin}/api/content`)).json();
  const publication = await (await http.get(`${origin}/api/public-content`)).text();
  await mkdir(".visual-qa/media-library", { recursive: true });
  await writeFile(".visual-qa/media-library/original-draft.json", JSON.stringify(original));
  const synced = await http.post(`${origin}/api/media/sync`, { headers: { origin } }); assert.equal(synced.status(), 200, await synced.text());
  const again = await http.post(`${origin}/api/media/sync`, { headers: { origin } }); assert.equal((await again.json()).added, 0, "Import must be idempotent");
  const inventory = await (await http.get(`${origin}/api/media?pageSize=100`)).json();
  for (let page = 2; inventory.media.length < inventory.total; page++) {
    const batch = await (await http.get(`${origin}/api/media?pageSize=100&page=${page}`)).json();
    inventory.media.push(...batch.media);
  }
  assert.ok(inventory.media.some((media: any) => media.existing && media.mimeType.startsWith("video/")), "Existing videos must be visible");
  let protectedMedia: any;
  for (const item of inventory.media) {
    const detail = await (await http.get(`${origin}/api/media/${item.assetId}`)).json();
    if (detail.media.usages.some((usage: any) => usage.location.startsWith("Revision"))) { protectedMedia = detail.media; break; }
  }
  assert.ok(protectedMedia, "Revision media must be discoverable");
  const blocked = await http.delete(`${origin}/api/media/${protectedMedia.assetId}`, { headers: { origin } }); assert.equal(blocked.status(), 409); assert.ok((await blocked.json()).usages.length);
  assert.equal((await http.post(`${origin}/api/media/sync`, { headers: { origin: "https://untrusted.example" } })).status(), 403);
  const invalid = await http.post(`${origin}/api/media`, { headers: { origin }, multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") }, alt: "Bad image" } }); assert.equal(invalid.status(), 415);
  const oversized = await http.post(`${origin}/api/media`, { headers: { origin }, multipart: { file: { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5*1024*1024+1) }, alt: "Too large" } }); assert.equal(oversized.status(), 415);
  const page = await context.newPage(), errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  page.on("response", async (response: any) => { if (response.url() === `${origin}/api/media` && response.request().method() === "POST" && response.ok()) uploaded.push(await response.json()); });
  await page.goto(`${origin}/content`, { waitUntil: "domcontentloaded", timeout: 120000 });
  console.log("PASS: API auth, origins, legacy inventory, revision protection and upload validation.");
  const library = page.getByRole("region", { name: "Media Library", exact: true });
  await library.getByRole("button", { name: "Refresh library", exact: true }).waitFor();
  await page.waitForFunction(() => !(document.querySelector('input[aria-label="Upload media files"]') as HTMLInputElement)?.disabled);
  const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#9b1d24" } }).png().toBuffer();
  const prefix = `library-qa-${id}`;
  await library.getByLabel("Upload media files").setInputFiles([{ name: `${prefix}-front.png`, mimeType: "image/png", buffer: png }, { name: `${prefix}-back.png`, mimeType: "image/png", buffer: png }]);
  await library.getByText("2 of 2 files uploaded and saved to Media Library.", { exact: true }).waitFor({ timeout: 60000 });
  assert.equal(uploaded.length, 2); console.log("PASS: browser multiple uploads.");
  const image = uploaded[0];
  const savedFile = await http.get(image.src); assert.equal(savedFile.status(), 200);
  const anonymous = await browser.newContext(); assert.equal((await anonymous.request.get(image.src)).status(), 404); await anonymous.close();
  await library.getByRole("button", { name: "Images", exact: true }).click();
  await library.getByLabel("Search media").fill(prefix);
  assert.equal(await library.locator(".ml-card").count(), 2);
  await library.locator(".ml-card").first().click();
  let details = page.getByRole("dialog", { name: "Media details", exact: true });
  await details.getByText("image/png", { exact: true }).waitFor();
  assert.ok(await details.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 32));
  await details.getByRole("button", { name: "Close media dialog", exact: true }).click();
  // A content-field picker must reuse the existing bytes and ID, with no new upload.
  await page.locator("summary").filter({ hasText: /^Advanced content fields$/ }).click();
  await page.locator("summary").filter({ hasText: /^Global$/ }).click();
  const logo = page.locator("fieldset").filter({ has: page.locator("legend").filter({ hasText: /^Logo$/ }) }).last();
  await logo.getByRole("button", { name: "Choose from Media Library", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose an image", exact: true });
  await picker.getByLabel("Search media").fill(prefix);
  await picker.locator(".ml-card").first().click();
  await page.getByRole("dialog", { name: "Select media", exact: true }).getByRole("button", { name: "Use selected media", exact: true }).click();
  await picker.waitFor({ state: "hidden" }); assert.equal(uploaded.length, 2);
  // Persist an ID-less URL reference to test old content, and restore it afterward.
  const content = structuredClone(original.content); content.global.socialPreview = { src: image.src, alt: "Media QA reference" };
  const saved = await http.put(`${origin}/api/content`, { headers: { origin }, data: { content, version: original.version } }); assert.equal(saved.status(), 200, await saved.text()); version = (await saved.json()).version;
  const inUse = await http.delete(`${origin}/api/media/${image.assetId}`, { headers: { origin } }); assert.equal(inUse.status(),409); assert.ok((await inUse.json()).usages.some((usage: any) => usage.path === "global.socialPreview"));
  const restored = await http.put(`${origin}/api/content`, { headers: { origin }, data: { content: original.content, version } }); assert.equal(restored.status(),200); version = undefined;
  const videoBytes = await readFile(path.resolve(process.env.PUBLIC_REPO_PATH || "../ganesh-website", "public/videos/featured/jersey.mp4"));
  const videoResponse = await http.post(`${origin}/api/media`, { headers: { origin }, multipart: { file: { name: `${prefix}.mp4`, mimeType: "video/mp4", buffer: videoBytes }, alt: "QA video" } }); assert.equal(videoResponse.status(),200,await videoResponse.text());
  const video = await videoResponse.json(); uploaded.push(video);
  assert.deepEqual(await (await http.get(video.src)).body(),videoBytes);
  const range = await http.get(video.src,{headers:{range:"bytes=0-99"}}); assert.equal(range.status(),206); assert.equal((await range.body()).length,100);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => !(document.querySelector('input[aria-label="Upload media files"]') as HTMLInputElement)?.disabled);
  await library.getByRole("button", { name: "Videos", exact: true }).click(); await library.getByLabel("Search media").fill(prefix);
  await library.locator(".ml-card").first().waitFor();
  assert.equal(await library.locator(".ml-card").count(),1); await library.locator(".ml-card").click();
  details = page.getByRole("dialog", { name: "Media details", exact: true });
  await details.locator("video").evaluate((v: HTMLVideoElement) => new Promise<void>((resolve,reject) => { if (v.readyState >= 1) resolve(); else { v.addEventListener("loadedmetadata",()=>resolve(),{once:true}); v.addEventListener("error",()=>reject(Error("Video preview failed")),{once:true}); } }));
  assert.equal(await details.locator("video").evaluate((v: HTMLVideoElement)=>v.controls && v.videoWidth>0),true);
  await details.getByRole("button", { name: "Close media dialog", exact: true }).click();
  await library.getByRole("button", { name: "All Media", exact: true }).click(); await library.getByLabel("Search media").fill(prefix);
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>(".ml-grid img")).every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({path:".visual-qa/media-library/desktop.png",fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => (document.querySelector(".admin-sidebar")?.getBoundingClientRect().right || 0) <= 0);
  await library.locator(".ml-heading").scrollIntoViewIfNeeded();
  await page.screenshot({path:".visual-qa/media-library/mobile.png",fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"No mobile overflow");
  // Exercise the actual UI confirmation and then ensure the stored bytes are gone.
  await library.getByRole("button").filter({ hasText: `${prefix}-back.png` }).click();
  details = page.getByRole("dialog", { name: "Media details", exact: true });
  await details.getByRole("button",{name:"Delete media",exact:true}).click(); await details.getByRole("button",{name:"Delete permanently",exact:true}).click();
  await details.waitFor({state:"hidden"}); await library.getByText("Media permanently deleted.",{exact:true}).waitFor();
  const deletedImage = uploaded.find((item)=>item.assetId!==image.assetId && item.assetId!==video.assetId);
  assert.equal((await http.get(deletedImage.src)).status(),404);
  await assert.rejects(stat(path.join(process.env.CMS_MEDIA_DIR || "var/media","content",path.basename(deletedImage.src))));
  // Stale sessions cannot reintroduce deleted media by raw URL.
  const current = await (await http.get(`${origin}/api/content`)).json();
  const stale = structuredClone(current.content); stale.global.socialPreview={src:deletedImage.src,alt:"Deleted media"};
  assert.equal((await http.put(`${origin}/api/content`,{headers:{origin},data:{content:stale,version:current.version}})).status(),422);
  assert.equal(await (await http.get(`${origin}/api/public-content`)).text(),publication,"Published content unchanged");
  assert.deepEqual(errors,[]);
  console.log("PASS: auth/origin controls, existing inventory and idempotent sync, multi-upload, image/video previews, metadata, search/filter, picker reuse, persistent draft reference protection, revision protection, byte ranges, physical deletion, stale-save protection and responsive layout. Publication unchanged.");
} finally {
  if (version !== undefined && original) {
    const restored = await http.put(`${origin}/api/content`,{headers:{origin},data:{content:original.content,version}}); assert.equal(restored.status(),200,"Concurrent edits detected: restore QA backup manually.");
  }
  for (const media of uploaded) { const response=await http.delete(`${origin}/api/media/${media.assetId}`,{headers:{origin}}); assert.ok([200,404].includes(response.status()),`Could not clean up QA media ${media.assetId}`); }
  await pool.execute("DELETE FROM admin_profiles WHERE id=?",[id]);
  await context.close(); await browser.close(); await pool.end();
}
