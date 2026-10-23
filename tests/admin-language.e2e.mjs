// Verify presentation and protected flows without changing saved website content or files.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3001";
const access = await readFile(".local-setup/admin-access.txt", "utf8");
const fixture = JSON.parse(await readFile("lib/content/current-design.json", "utf8"));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const usage = (location, path = "workCategories.3.tiles.1.image") => ({ location, path, page: "Our Work", section: "Sports · Team uniforms" });
const asset = (assetId, filename, usages = []) => ({ assetId, filename, usages, src: `${origin}/qa-media/${assetId}.webp`, alt: "Team uniforms", mimeType: "image/webp", size: 24000, uploadedAt: null, width: 1200, height: 800 });
let media = [
  asset("00000000-0000-4000-8000-000000000001", "team-uniforms.webp", [usage("Published 4 · private-project"), usage("Draft 5 · private-project"), ...Array.from({ length: 35 }, (_, i) => usage(`Revision ${i} · private-project`))]),
  asset("00000000-0000-4000-8000-000000000002", "history-only.webp", [usage("Revision 4 · private-project")]),
  asset("00000000-0000-4000-8000-000000000003", "backup-only.webp", [usage("Website fallback · current-design.json")]),
  asset("00000000-0000-4000-8000-000000000004", "unpublished.webp", [usage("Draft 5 · private-project")]),
  asset("00000000-0000-4000-8000-000000000005", "unused.webp"),
  asset("00000000-0000-4000-8000-000000000006", "race.webp"),
];
let content = structuredClone(fixture), version = 21, writes = 0, deletes = 0, publishCount = 0;
let lastSaved;
let testDb, testSessionHash;
const details = page.getByRole("dialog", { name: "Media details", exact: true });
async function openFile(name) { await page.locator(".ml-card").filter({ hasText: name }).click(); await details.waitFor(); }
async function closeFile() { await details.getByRole("button", { name: "Close media dialog" }).click(); }
try {
  if (process.env.ADMIN_TEST_DB_SESSION === "1") {
    require("@next/env").loadEnvConfig(process.cwd());
    const mysql = require("mysql2/promise");
    testDb = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
    const [admins] = await testDb.execute("SELECT id FROM admin_profiles WHERE role = 'administrator' AND deleted_at IS NULL LIMIT 1");
    assert.ok(admins[0], "An existing local administrator is required");
    const token = randomBytes(32).toString("base64url");
    testSessionHash = createHash("sha256").update(token).digest("hex");
    await testDb.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))", [testSessionHash, admins[0].id]);
    await context.addCookies([{ name: "ganesh_admin_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`${origin}/dashboard`, { timeout: 60000 });
  } else {
  await page.goto(`${origin}/login`, { timeout: 60000 });
  await page.getByLabel("Email address", { exact: true }).fill(access.match(/^Email: (.+)$/m)[1].trim());
  await page.getByLabel("Password", { exact: true }).fill(access.match(/^Temporary password: (.+)$/m)[1].trim());
  await page.getByRole("button", { name: "Sign in to Admin" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  }
  assert.doesNotMatch(await page.locator(".dashboard-content").innerText(), /MariaDB|revision|metadata|database/i);
  const actual = await context.request.get(`${origin}/api/media`);
  assert.equal(actual.status(), 200);
  const actualMedia = (await actual.json()).media;
  assert.ok(actualMedia.some((item) => item.usages.length), "Real reference tracking is available");
  for (const item of actualMedia) for (const ref of item.usages) assert.ok(ref.kind && ref.page && ref.section, "Server supplies snapshot-specific presentation names");
  console.log("PASS: authenticated dashboard wording and real server reference metadata");
  await page.route("**/api/content", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { content, version } });
    writes++;
    if (method === "PUT") { lastSaved = route.request().postDataJSON().content; content = lastSaved; version++; }
    if (method === "POST") publishCount++;
    return route.fulfill({ json: { ok: true, content, version, revalidated: true } });
  });
  const previewImage = await readFile("public/images/work/sports-02.webp");
  await page.route("**/qa-media/**", (route) => route.fulfill({ contentType: "image/webp", body: previewImage }));
  await page.route("**/api/media", (route) => route.fulfill({ json: { media } }));
  await page.route("**/api/media/sync", (route) => route.fulfill({ json: { added: 0 } }));
  await page.route("**/api/media/*", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletes++;
    if (route.request().url().endsWith("00000000-0000-4000-8000-000000000006")) return route.fulfill({ status: 409, json: { error: "Technical reference information", usages: [usage("Published 22 · private-project")] } });
    media = media.filter((item) => !route.request().url().endsWith(item.assetId));
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/editor-preview", (route) => route.fulfill({ status: 503, json: { error: "Preview temporarily unavailable." } }));
  await page.goto(`${origin}/content`);
  await openFile("team-uniforms.webp");
  assert.ok(await details.getByText("WebP image", { exact: true }).isVisible());
  assert.equal(await details.getByText("Not available", { exact: true }).count(), 1);
  assert.equal(await details.locator(".ml-usage-section").first().locator(".ml-usages > li").count(), 1);
  assert.equal(await details.locator(".ml-usage-section").first().locator(".ml-usages ul li").count(), 1);
  assert.ok(await details.getByRole("button", { name: "Delete media", exact: true }).isDisabled());
  assert.ok(await details.getByText("This image is used on your website. Replace it there before deleting it.", { exact: true }).isVisible());
  await details.getByText("Saved history and backups", { exact: true }).click();
  assert.equal(await details.locator(".ml-history .ml-usages ul li").count(), 1, "35 histories form one readable section");
  assert.doesNotMatch(await details.innerText(), /workCategories|image\/webp|private-project|Revision \d|Draft \d|Published \d/);
  await mkdir(".visual-qa", { recursive: true });
  for (const [width, height] of [[1440, 960], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const box = await details.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    assert.equal(await details.evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth), false, "Dialog has no horizontal overflow");
    const body = details.locator(".ml-dialog-body");
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    assert.ok(await details.getByRole("button", { name: "Close media dialog" }).isVisible());
    await body.evaluate((element) => { element.scrollTop = 0; });
    if (width === 1440 || width === 390) await page.screenshot({ path: `.visual-qa/media-details-${width}.png` });
  }
  await page.keyboard.press("Escape");
  assert.ok(await page.locator(".ml-card").filter({ hasText: "team-uniforms.webp" }).evaluate((element) => element === document.activeElement));
  for (const [filename, reason] of [["history-only.webp", /saved history and cannot be deleted/], ["backup-only.webp", /website backup and cannot be deleted/], ["unpublished.webp", /changes that are not live yet/]]) {
    await openFile(filename);
    assert.match(await details.locator(".ml-deletion-note").innerText(), reason);
    assert.ok(await details.getByRole("button", { name: "Delete media", exact: true }).isDisabled());
    await closeFile();
  }
  await openFile("unused.webp");
  await details.getByRole("button", { name: "Delete media", exact: true }).click();
  await details.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(deletes, 0);
  await details.getByRole("button", { name: "Delete media", exact: true }).click();
  await details.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await details.waitFor({ state: "detached" });
  assert.equal(deletes, 1);
  await openFile("race.webp");
  await details.getByRole("button", { name: "Delete media", exact: true }).click();
  await details.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await details.getByRole("alert").waitFor();
  assert.ok(await details.getByRole("button", { name: "Delete media", exact: true }).isDisabled());
  assert.match(await details.getByRole("alert").innerText(), /used on your website/);
  await closeFile();
  console.log("PASS: grouped live/history uses, every deletion restriction, cancel/delete/race checks, 5 responsive sizes, Escape and restored focus");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByText("Page text and website details", { exact: true }).click();
  const stories = page.locator("details.cms-group").filter({ has: page.locator(":scope > summary", { hasText: "Our Work stories" }) });
  await stories.locator(":scope > summary").click();
  await stories.locator(".cms-item > summary").first().click();
  assert.equal(await stories.getByLabel("Item", { exact: true }).count(), 0);
  assert.equal(await stories.getByLabel("Page address", { exact: true }).count(), 0);
  await stories.locator(".cms-item .cms-item > summary").first().click();
  const pickButton = stories.getByRole("button", { name: "Choose from Media Library" }).first();
  await pickButton.click();
  const picker = page.getByRole("dialog", { name: "Choose an image", exact: true });
  await picker.locator(".ml-card").filter({ hasText: "team-uniforms.webp" }).click();
  const selection = page.getByRole("dialog", { name: "Select media", exact: true });
  await selection.getByRole("textbox", { name: "Image description (alt text)", exact: true }).fill("School team in their new uniforms");
  await selection.getByRole("button", { name: "Use selected media", exact: true }).click();
  await picker.waitFor({ state: "detached" });
  await openFile("team-uniforms.webp");
  assert.ok(await details.getByRole("button", { name: "Delete media", exact: true }).isDisabled(), "Unsaved image selections stay protected");
  assert.doesNotMatch(await details.innerText(), /workCategories|private-project/);
  await closeFile();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await page.getByText("Changes saved. Publish when you are ready to update the website.", { exact: true }).waitFor();
  assert.equal(lastSaved.workCategories[0].tiles[0].image.alt, "School team in their new uniforms");
  assert.equal(lastSaved.workCategories[0].id, fixture.workCategories[0].id);
  assert.equal(lastSaved.workCategories[0].slug, fixture.workCategories[0].slug);
  assert.deepEqual(lastSaved.designMedia, fixture.designMedia);
  assert.deepEqual(lastSaved.global, fixture.global);
  await page.getByRole("button", { name: "Save & Publish", exact: true }).click();
  await page.getByRole("dialog", { name: "Publish your changes?" }).getByRole("button", { name: "Publish changes", exact: true }).click();
  await page.getByText("Your website is up to date.", { exact: true }).waitFor();
  assert.equal(publishCount, 1);
  await page.goto(`${origin}/editor`);
  await page.getByRole("button", { name: "Edit Introduction", exact: true }).click();
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await page.getByText("Preview updated. Save Draft to keep your changes.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await page.getByText("Changes saved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save & Publish", exact: true }).click();
  await page.getByRole("dialog", { name: "Publish your changes?" }).getByRole("button", { name: "Publish changes", exact: true }).click();
  await page.getByText("Your website is up to date.", { exact: true }).waitFor();
  console.log("PASS: media picker and alt text; save/publish from content and visual editor preserve hidden identifiers, backup content, and unrelated settings");
  for (const section of ["general", "branding", "contact", "account", "users"]) {
    await page.goto(`${origin}/settings/${section}`);
    await page.locator(".settings-card").first().waitFor();
    assert.doesNotMatch(await page.locator(".settings-page").innerText(), /MariaDB|database|\.src|revision|implementation/);
    if (section === "branding") {
      assert.equal(await page.locator(".branding-previews img").count(), 2);
      assert.equal(await page.locator(".settings-form").innerText().then((text) => text.includes("/images/")), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${section} fits mobile`);
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { displayName: "Test editor", role: "editor", roleName: "Editor", permissions: { publish: false, manageUsers: false } } }));
  for (const path of ["content", "editor"]) {
    await page.goto(`${origin}/${path}`);
    await page.getByRole("button", { name: "Save Draft", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Save & Publish", exact: true }).count(), 0);
    await page.getByText("Ask a team member with publishing access to make your changes live", { exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: all settings pages, mobile overflow, no browser exceptions; ${writes} intercepted content writes, ${deletes} intercepted deletions; no real content/file writes`);
} finally {
  if (testDb) { if (testSessionHash) await testDb.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [testSessionHash]); await testDb.end(); }
  await browser.close();
}
