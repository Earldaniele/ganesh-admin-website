// Uses local MariaDB/media storage. Only temporary QA records are written;
// editor content is a browser fixture and publication is never changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { snapshots, usagesFor } from "../lib/media/library.ts";
import { contentSnapshotSchema } from "../lib/content/schema.ts";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const db = await require("mysql2/promise").createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3001";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(30000);
const http = context.request, uploaded = [], errors = [], checks = [];
const hash = createHash("sha256").update(randomUUID()).digest("hex");
const token = randomBytes(32).toString("base64url"), sessionHash = createHash("sha256").update(token).digest("hex");
const prefix = `performance-qa-${hash.slice(0, 10)}`;
const headers = { origin };
async function json(response) { assert.equal(response.ok(), true, await response.text()); return response.json(); }
const png = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#9b1d24" } }).png().toBuffer();
async function upload(name) {
  const item = await json(await http.post(`${origin}/api/media`, { headers, multipart: { file: { name: `${prefix}-${name}.png`, mimeType: "image/png", buffer: png }, alt: `QA ${name}` } }));
  uploaded.push(item); return item;
}
let publication, savedDraft, qaPage;
function record(message) { checks.push(message); console.log(`PASS: ${message}`); }
try {
  const [users] = await db.query("SELECT id FROM admin_profiles WHERE role='administrator' AND deleted_at IS NULL LIMIT 1");
  assert.ok(users[0]);
  await db.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))", [sessionHash, users[0].id]);
  await context.addCookies([{ name: "ganesh_admin_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
  savedDraft = await json(await http.get(`${origin}/api/content`));
  publication = await (await http.get(`${origin}/api/public-content`)).text();
  const inventory = await json(await http.get(`${origin}/api/media`));
  assert.equal(inventory.media.length, 36); assert.ok(inventory.total > 36);
  assert.ok(inventory.media.every(item => item.usages.length === 0));
  const second = await json(await http.get(`${origin}/api/media?page=2`));
  assert.ok(!second.media.some(item => inventory.media.some(first => first.assetId === item.assetId)));
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${origin}/api/media`)).status(), 401);
  assert.equal((await anonymous.request.get(`${origin}/api/media/${inventory.media[0].assetId}`)).status(), 401);
  assert.equal((await anonymous.request.delete(`${origin}/api/media/${inventory.media[0].assetId}`, { headers })).status(), 401);
  assert.equal((await http.delete(`${origin}/api/media/${inventory.media[0].assetId}`, { headers: { origin: "https://untrusted.example" } })).status(), 403);
  const [assets] = await db.query("SELECT * FROM media_assets WHERE deleted_at IS NULL");
  const contentHistory = await snapshots(db);
  const protectedAsset = assets.find(asset => usagesFor(asset, contentHistory, origin).length);
  assert.ok(protectedAsset);
  const blocked = await http.delete(`${origin}/api/media/${protectedAsset.id}`, { headers });
  assert.equal(blocked.status(), 409); assert.ok((await blocked.json()).usages.length);
  record("API pagination, bounded lightweight inventory, authorization/origin checks and authoritative referenced-image protection");

  const hero = await upload("hero"), otherPage = await upload("production"), unused = await upload("unused"), stale = await upload("stale"), missing = await upload("missing");
  assert.equal((await anonymous.request.get(hero.src)).status(), 404);
  assert.equal((await anonymous.request.get(`${origin}/api/media/${hero.assetId}/thumbnail`)).status(), 401);
  const thumb = await http.get(`${origin}/api/media/${hero.assetId}/thumbnail`);
  assert.equal(thumb.status(), 200); assert.equal(thumb.headers()["cache-control"], "private, no-store");
  assert.equal((await sharp(await thumb.body()).metadata()).width, 384);
  await unlink(path.join(process.env.CMS_MEDIA_DIR || "var/media", "content", path.basename(missing.src)));
  assert.equal((await http.get(missing.src)).status(), 404);
  assert.equal((await http.get(`${origin}/api/media/${missing.assetId}/thumbnail`)).status(), 404);
  assert.equal((await json(await http.delete(`${origin}/api/media/${missing.assetId}`, { headers }))).missingFileRemoved, true);
  const duplicateId = randomUUID();
  await assert.rejects(db.execute("INSERT INTO media_assets (id, storage_path, mime_type, size_bytes, original_filename, alt_text) VALUES (?,?,'image/png',?,'duplicate QA','Duplicate QA')", [duplicateId, `content/${path.basename(unused.src)}`, png.length]), { code: "ER_DUP_ENTRY" });
  assert.equal((await http.get(unused.src)).status(), 200);
  record("Authenticated 384px thumbnails, private originals, missing-file cleanup and shared-file ownership guard");

  const racedDraftId = randomUUID();
  const unusedDetails = await json(await http.get(`${origin}/api/media/${unused.assetId}`));
  assert.equal(unusedDetails.media.usages.length, 0);
  try {
    await db.execute("INSERT INTO saved_editor_drafts (id,site_key,name,content,base_content,changes,change_count,affected_sections) VALUES (?,'ganesh-main',?,?,?,'[]',1,'[]')", [racedDraftId, prefix, JSON.stringify({ global: { logo: { src: unused.src, assetId: unused.assetId, alt: "QA reference" } } }), "{}"]);
    const raced = await http.delete(`${origin}/api/media/${unused.assetId}`, { headers });
    assert.equal(raced.status(), 409);
    assert.ok((await raced.json()).usages.some(usage => usage.location === `Saved draft · ${prefix}`));
    assert.equal((await http.get(unused.src)).status(), 200);
  } finally { await db.execute("DELETE FROM saved_editor_drafts WHERE id=?", [racedDraftId]); }
  // Another tab/process must join the discovery already holding the database lock.
  await db.query("SELECT GET_LOCK('ganesh_media_import', 0)");
  try {
    const joined = await http.post(`${origin}/api/media/sync`, { headers });
    assert.equal(joined.status(), 202); assert.equal((await joined.json()).running, true);
    assert.equal((await json(await http.get(`${origin}/api/media/sync`))).running, true);
  } finally { await db.query("SELECT RELEASE_LOCK('ganesh_media_import')"); }
  assert.equal((await json(await http.get(`${origin}/api/media/sync`))).running, false);
  record("Deletion rechecks references added after details opened; concurrent discovery joins the database lock without duplicate work");

  const page = await context.newPage(); qaPage = page;
  page.on("pageerror", error => errors.push(error.message));
  let syncFinished = false, syncCalls = 0;
  await page.route("**/api/media/sync", async route => { syncCalls++; await new Promise(resolve => setTimeout(resolve, 4000)); syncFinished = true; await route.fulfill({ json: { added: 0 } }); });
  const start = performance.now();
  await page.goto(`${origin}/content`, { waitUntil: "domcontentloaded" });
  const library = page.getByRole("region", { name: "Media Library", exact: true });
  await library.locator(".ml-card").first().waitFor();
  const openMs = performance.now() - start;
  assert.equal(syncFinished, false, "Saved library must render while discovery is still pending");
  await library.getByRole("button", { name: "Next page", exact: true }).click();
  await library.getByText(/Page 2 of/).waitFor();
  await library.getByLabel("Search media").fill(prefix);
  await library.getByText(/Page 1 of 1/).waitFor();
  assert.equal(await library.locator(".ml-card").count(), 4);
  const cards = await library.locator(".ml-card img").evaluateAll(images => images.map(image => ({ src: image.getAttribute("src"), lazy: image.loading })));
  assert.ok(cards.every(card => card.src.includes("/thumbnail") && card.lazy === "lazy"));
  record(`Saved library visible before delayed discovery (${Math.round(openMs)}ms local dev navigation); server search/pagination and lazy thumbnail cards`);

  const uploads = [];
  page.on("response", async response => {
    if (response.url() === `${origin}/api/media` && response.request().method() === "POST" && response.ok()) { const item = await response.json(); uploads.push(item); uploaded.push(item); }
  });
  await library.getByLabel("Upload media files").setInputFiles([{ name: `${prefix}-browser-front.png`, mimeType: "image/png", buffer: png }, { name: `${prefix}-browser-back.png`, mimeType: "image/png", buffer: png }]);
  await library.getByText("2 of 2 files uploaded and saved to Media Library.", { exact: true }).waitFor();
  assert.equal(uploads.length, 2); assert.equal(await library.locator(".ml-card").count(), 6);
  record("Browser multiple upload, progress completion and list refresh");

  const videoBytes = await readFile(path.resolve(process.env.PUBLIC_REPO_PATH || "../ganesh-website", "public/videos/featured/jersey.mp4"));
  const video = await json(await http.post(`${origin}/api/media`, { headers, multipart: { file: { name: `${prefix}-video.mp4`, mimeType: "video/mp4", buffer: videoBytes }, alt: "QA private video" } }));
  uploaded.push(video);
  assert.equal((await anonymous.request.get(video.src)).status(), 404);
  const range = await http.get(video.src, { headers: { range: "bytes=0-99" } });
  assert.equal(range.status(), 206); assert.equal((await range.body()).length, 100);

  // A fixture supplies private images without saving any shared draft/content.
  const fixture = structuredClone(savedDraft);
  fixture.content.editorIntegrationVersion = 2;
  fixture.content.featuredProducts[0].video = { kind: "video", src: video.src, assetId: video.assetId, alt: "QA private video", captions: "" };
  fixture.content.pages.home.hero.image = { ...hero, alt: "QA hero" };
  fixture.content.editorial.images.productionHero = { ...otherPage, alt: "QA production" };
  fixture.content = contentSnapshotSchema.parse(fixture.content);
  await page.route("**/api/content", route => route.request().method() === "GET" ? route.fulfill({ json: fixture }) : route.abort());
  await page.addInitScript(() => { window.qaMessages = []; window.qaAdminMedia = []; window.addEventListener("message", event => { if (event.data?.source === "ganesh-public-preview") window.qaMessages.push(event.data); if (event.data?.source === "ganesh-admin-editor") window.qaAdminMedia.push({ type: event.data.type, mediaKeys: Object.keys(event.data.media || {}) }); }); });
  let heroReads = 0, productionReads = 0, heroFinished = false;
  await page.route(hero.src, async route => { if (route.request().resourceType() === "fetch") { heroReads++; await new Promise(resolve => setTimeout(resolve, 3500)); heroFinished = true; } await route.continue().catch(() => {}); });
  await page.route(otherPage.src, async route => { if (route.request().resourceType() === "fetch") productionReads++; await route.continue(); });
  await page.goto(`${origin}/editor`, { waitUntil: "domcontentloaded" });
  const preview = page.frameLocator('iframe[title="Ganesh website visual preview"]');
  await preview.locator("#home").waitFor({ timeout: 90000 });
  await page.waitForFunction(() => window.qaMessages.some(message => message.type === "media-needed"));
  assert.equal(heroFinished, false, "Preview content must arrive before slow hero bytes");
  assert.equal(productionReads, 0, "An off-page image must not be downloaded");
  await page.getByRole("button", { name: "Edit Introduction", exact: true }).click();
  const copy = page.locator(".ve-panel").getByLabel("Introductory text", { exact: true }).first();
  const edited = `${prefix} unsaved text`;
  await copy.fill(edited);
  await preview.getByText(edited, { exact: true }).waitFor();
  assert.equal(heroFinished, false, "Typing must update before media settles");
  await page.getByLabel("Page", { exact: true }).selectOption("production");
  await preview.locator(".interior-hero").waitFor();
  await page.waitForFunction(() => window.qaMessages.some(message => message.type === "media-needed" && message.page === "production"));
  await page.getByLabel("Page", { exact: true }).selectOption("home");
  await preview.getByText(edited, { exact: true }).waitFor();
  await preview.locator('#home img[alt="QA hero"]').waitFor();
  await preview.locator('#home img[alt="QA hero"]').evaluate(img => img.complete && img.naturalWidth > 4 || new Promise(resolve => img.addEventListener("load", resolve, { once: true })));
  const readsAfterLoad = heroReads;
  await page.getByRole("button", { name: "Edit Introduction", exact: true }).click();
  await copy.fill(edited + " again");
  await preview.getByText(edited + " again", { exact: true }).waitFor();
  assert.equal(heroReads, readsAfterLoad, "Text edits reuse cached bytes");
  const previewFrame = page.frames().find(frame => frame.url().includes("/editor-preview?"));
  const lastSnapshot = await previewFrame.evaluate(() => window.qaAdminMedia.filter(message => message.type === "snapshot").at(-1));
  assert.deepEqual(lastSnapshot.mediaKeys, [], "Unchanged media must not be retransmitted with text edits");
  assert.equal(await page.locator(".ve-save-state").filter({ hasText: "Unsaved changes" }).count(), 1);
  record("Immediate preview/text updates during slow media, off-page deferral, obsolete page request cancellation, page switching, cached-media reuse and unsaved text preservation");

  await previewFrame.goto(previewFrame.url(), { waitUntil: "domcontentloaded" });
  await preview.getByText(edited + " again", { exact: true }).waitFor();
  assert.equal(heroReads, readsAfterLoad, "Reconnecting the frame reuses private bytes without reloading the editor");
  record("Private preview frame reconnect preserves unsaved content and rehydrates cached media");

  await preview.locator("#featured").scrollIntoViewIfNeeded();
  await previewFrame.waitForFunction(() => document.querySelector("#featured video source")?.getAttribute("src")?.startsWith("data:video/"));
  await preview.locator("#featured video").evaluate(videoElement => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Private video metadata timed out")), 15000);
    videoElement.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
    videoElement.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Private video playback failed")); }, { once: true });
    videoElement.load();
  }));
  assert.ok(await preview.locator("#featured video").evaluate(videoElement => videoElement.videoWidth > 0 && videoElement.controls));
  record("Visible private MP4 source discovery, in-memory preview playback and authenticated byte ranges");

  const pickerButton = page.locator(".ve-panel").getByRole("button", { name: "Choose from Media Library", exact: true }).first();
  await pickerButton.click();
  const picker = page.getByRole("dialog", { name: "Choose an image", exact: true });
  await picker.getByLabel("Search media").fill(`${prefix}-unused`);
  await picker.locator(".ml-card").filter({ hasText: `${prefix}-unused.png` }).click();
  let details = page.getByRole("dialog", { name: "Select media", exact: true });
  const deleteButton = details.getByRole("button", { name: "Delete media", exact: true });
  await deleteButton.waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(button => button.textContent === "Delete media" && !button.disabled));
  await deleteButton.click();
  await details.getByRole("group", { name: "Confirm permanent deletion" }).locator("img").waitFor();
  await page.screenshot({ path: ".visual-qa/performance/deletion-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await details.evaluate(element => element.scrollWidth > element.clientWidth), false);
  await page.screenshot({ path: ".visual-qa/performance/deletion-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await details.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await http.get(unused.src)).status(), 200);
  await deleteButton.click();
  // A failed delete keeps the dialog/selection and the editor's unsaved text.
  await page.route(`**/api/media/${unused.assetId}`, route => route.request().method() === "DELETE" ? route.fulfill({ status: 500, json: { error: "QA storage failure" } }) : route.continue());
  await details.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await details.getByRole("alert").filter({ hasText: "QA storage failure" }).waitFor();
  await page.unroute(`**/api/media/${unused.assetId}`);
  await deleteButton.click(); await details.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await details.waitFor({ state: "hidden" });
  assert.equal((await http.get(unused.src)).status(), 404);
  await picker.getByText("No media matches. Try another search or upload a file.", { exact: true }).waitFor();
  await picker.getByLabel("Search media").fill(`${prefix}-stale`);
  await picker.locator(".ml-card").filter({ hasText: `${prefix}-stale.png` }).click();
  details = page.getByRole("dialog", { name: "Select media", exact: true });
  await details.getByRole("button", { name: "Use selected media", exact: true }).waitFor();
  await http.delete(`${origin}/api/media/${stale.assetId}`, { headers });
  await details.getByRole("button", { name: "Use selected media", exact: true }).click();
  await details.getByRole("alert").filter({ hasText: /removed|another file/ }).first().waitFor();
  await details.getByRole("button", { name: "Close media dialog", exact: true }).click();
  await picker.getByLabel("Search media").fill(`${prefix}-hero`);
  await picker.locator(".ml-card").filter({ hasText: `${prefix}-hero.png` }).click();
  details = page.getByRole("dialog", { name: "Select media", exact: true });
  await details.getByText(/selected in changes that are not live yet/).waitFor();
  assert.equal(await details.getByRole("button", { name: "Delete media", exact: true }).isDisabled(), true);
  await details.getByRole("button", { name: "Use selected media", exact: true }).click();
  await picker.waitFor({ state: "hidden" });
  await preview.getByText(edited + " again", { exact: true }).waitFor();
  record("Picker deletion confirmation with filename/preview, cancellation, failed-delete recovery, unused deletion without reload, stale-selection rejection, unsaved-reference protection and image selection");

  await mkdir(".visual-qa/performance", { recursive: true });
  await page.screenshot({ path: ".visual-qa/performance/editor.png" });
  assert.deepEqual(errors, []);
  assert.deepEqual(await json(await http.get(`${origin}/api/content`)), savedDraft, "Shared draft unchanged");
  assert.equal(await (await http.get(`${origin}/api/public-content`)).text(), publication, "Publication unchanged");
  await writeFile(".visual-qa/performance/browser.json", JSON.stringify({ checks, openMs, heroReads, productionReads, syncCalls, errors }, null, 2));
  await anonymous.close();
} catch (error) {
  console.error("Completed checks:", checks);
  if (qaPage) {
    console.error("Page:", (await qaPage.locator("body").innerText()).slice(-5000));
    console.error("Frame URLs:", qaPage.frames().map(frame => frame.url().split("?")[0]));
    await qaPage.screenshot({ path: ".visual-qa/performance/failure.png" });
  }
  throw error;
} finally {
  for (const item of uploaded) {
    const response = await http.delete(`${origin}/api/media/${item.assetId}`, { headers });
    assert.ok([200, 404].includes(response.status()), `QA cleanup failed: ${item.assetId} ${await response.text()}`);
  }
  await db.execute("DELETE FROM admin_sessions WHERE token_hash=?", [sessionHash]);
  await context.close(); await browser.close(); await db.end();
}

