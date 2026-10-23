// Uses the local CMS for saved-draft persistence. Publishing is intercepted in the
// browser: the test never writes the shared draft or the live publication.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
require("@next/env").loadEnvConfig(process.cwd());
const db = await require("mysql2/promise").createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3001";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], ids = [], sessions = [];
const prefix = `Editor flow ${Date.now()}`;
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.dismiss());
async function signIn(ctx) {
  const [users] = await db.execute("SELECT id FROM admin_profiles WHERE role = 'administrator' AND deleted_at IS NULL LIMIT 1");
  assert.ok(users[0], "A local administrator must exist");
  const token = randomBytes(32).toString("base64url"), hash = createHash("sha256").update(token).digest("hex");
  sessions.push(hash);
  await db.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))", [hash, users[0].id]);
  await ctx.addCookies([{ name: "ganesh_admin_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
}
async function clickToolbar(name) { await page.locator(".ve-toolbar").getByRole("button", { name, exact: true }).click(); }
async function editHero(text) {
  await page.getByLabel("Page", { exact: true }).selectOption("home");
  await page.getByRole("button", { name: "Edit Introduction", exact: true }).click();
  await page.locator(".ve-panel").getByLabel("Introductory text", { exact: true }).first().fill(text);
}
async function openDrafts() { await page.locator(".ve-toolbar").getByRole("button", { name: /^Drafts \(/ }).click(); }
async function saveDraft(name) {
  await clickToolbar("Save Draft");
  await page.getByRole("dialog").getByLabel("Draft name").fill(name);
  const response = page.waitForResponse(r => r.url().endsWith("/api/editor-drafts") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Save Draft", exact: true }).click();
  const result = await (await response).json();
  assert.equal(result.ok, true, JSON.stringify(result)); ids.push(result.draft.id);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  return result.draft;
}
async function count(n) { await page.locator(".ve-toolbar").getByRole("button", { name: `Changes (${n})`, exact: true }).waitFor(); }
async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
try {
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${origin}/api/editor-drafts`)).status(), 401);
  await anonymous.close();
  await signIn(context);
  const original = await (await context.request.get(`${origin}/api/content`)).json();
  const live = await (await context.request.get(`${origin}/api/public-content`)).json();
  await page.goto(`${origin}/editor`, { waitUntil: "networkidle" });
  await count(0);
  await editHero(`${prefix} first`);
  await count(1);
  await page.locator(".ve-panel").getByLabel("Introductory text", { exact: true }).first().pressSequentially(" typing");
  await count(1);
  // Switch directly to another open panel, then another page, without applying.
  await page.getByRole("button", { name: "Edit About Ganesh", exact: true }).click();
  await page.getByLabel("Page", { exact: true }).selectOption("products");
  await count(1);
  await editHero(original.content.pages.home.hero.eyebrow);
  await count(0);
  await editHero(`${prefix} first`);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await count(1);
  // Review close/Keep editing preserve edits; per-field undo updates the count.
  await clickToolbar("Changes (1)");
  assert.match(await page.getByRole("dialog").innerText(), /Home \/ Introduction/);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: "Changes (1)", exact: true }).evaluate(el => el === document.activeElement), true);
  await clickToolbar("Changes (1)");
  await page.getByRole("dialog").getByRole("button", { name: /^Undo / }).click();
  await count(0);
  await page.getByRole("dialog").getByRole("button", { name: "Keep editing", exact: true }).click();
  await editHero(`${prefix} first`);
  const first = await saveDraft(`${prefix} A`);
  assert.equal(first.changeCount, 1);
  assert.equal(await page.locator(".ve-save-state").first().innerText(), `✓ Draft saved: ${prefix} A`);
  await count(1);
  await editHero(`${prefix} second`);
  assert.match(await page.locator(".ve-save-state").first().innerText(), /Unsaved changes/);
  const second = await saveDraft(`${prefix} B`);
  assert.notEqual(first.id, second.id);
  await editHero(`${prefix} unsaved`);
  await openDrafts();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`${prefix} A`) }).click();
  await page.getByRole("button", { name: "Load draft", exact: true }).waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /first/);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await page.locator(".ve-panel").getByLabel("Introductory text", { exact: true }).first().inputValue(), `${prefix} unsaved`, "Inspecting must not load the draft");
  await openDrafts();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`${prefix} A`) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Load draft", exact: true }).click();
  await page.getByRole("button", { name: "Save current edits first", exact: true }).click();
  await page.getByLabel("Draft name", { exact: true }).fill(`${prefix} recovery`);
  const recoveryResponse = page.waitForResponse(r => r.url().endsWith("/api/editor-drafts") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save Draft and load", exact: true }).click();
  const recovery = await (await recoveryResponse).json();
  assert.equal(recovery.ok, true); ids.push(recovery.draft.id);
  assert.equal(recovery.draft.content.pages.home.hero.eyebrow, `${prefix} unsaved`);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await editHero(`${prefix} first`);
  assert.match(await page.locator(".ve-save-state").first().innerText(), /Draft saved/);
  // Explicit discard and load, then reload and use a different signed-in session.
  await editHero(`${prefix} discard this`);
  await openDrafts();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`${prefix} B`) }).click();
  await page.getByRole("button", { name: "Load draft", exact: true }).click();
  await page.getByRole("button", { name: "Discard unsaved edits and load", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await editHero(`${prefix} second`);
  assert.match(await page.locator(".ve-save-state").first().innerText(), /Draft saved/);
  await page.reload({ waitUntil: "networkidle" });
  await openDrafts();
  for (const suffix of ["A", "B", "recovery"]) await page.getByRole("dialog").getByRole("button", { name: new RegExp(`${prefix} ${suffix}`) }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const fresh = await browser.newContext();
  await signIn(fresh);
  const persisted = await (await fresh.request.get(`${origin}/api/editor-drafts`)).json();
  assert.ok(ids.every(id => persisted.drafts.some(d => d.id === id)));
  await fresh.close();
  assert.deepEqual((await (await context.request.get(`${origin}/api/content`)).json()).content, original.content);
  assert.deepEqual(await (await context.request.get(`${origin}/api/public-content`)).json(), live);
  assert.equal((await context.request.post(`${origin}/api/editor-drafts`, { headers: { origin: "https://untrusted.example" }, data: { name: "Bad" } })).status(), 403);
  assert.equal((await context.request.post(`${origin}/api/editor-drafts`, { headers: { origin }, data: { name: "", content: original.content, baseContent: original.content } })).status(), 422);
  console.log("PASS: multiple drafts persisted across refresh/new sign-in; viewing is read-only; save/discard-before-load; live content unchanged");
  // Responsive review, keyboard focus trap, and discard-all confirmation.
  await editHero(`${prefix} mobile`);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await clickToolbar("Changes (1)");
  await page.getByRole("dialog").waitFor();
  await noOverflow();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.getByRole("dialog").evaluate(el => el.contains(document.activeElement)), true);
  await mkdir(".visual-qa/editor-drafts", { recursive: true });
  await page.screenshot({ path: ".visual-qa/editor-drafts/review-mobile.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Discard all", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Discard all", exact: true }).click();
  await count(0);
  await page.getByRole("dialog").getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editHero(`${prefix} published snapshot`);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  let submitted, failPublication = true, publishCalls = 0;
  await page.route("**/api/content", async route => {
    const request = route.request();
    if (request.method() === "PUT") {
      submitted = request.postDataJSON().content;
      return route.fulfill({ json: { ok: true, content: submitted, version: original.version + 1 } });
    }
    if (request.method() === "POST") {
      publishCalls++;
      return route.fulfill(failPublication ? { status: 503, json: { error: "Test publication failed; live content unchanged." } } : { json: { ok: true, revalidated: true } });
    }
    return route.continue();
  });
  await clickToolbar("Save & Publish");
  await page.keyboard.press("Escape");
  assert.equal(publishCalls, 0, "Closing confirmation cannot publish");
  await clickToolbar("Save & Publish");
  await page.getByRole("button", { name: "Publish changes", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /Test publication failed/ }).first().waitFor();
  await count(1);
  assert.equal(submitted.pages.home.hero.eyebrow, `${prefix} published snapshot`);
  failPublication = false;
  await clickToolbar("Save & Publish");
  await page.getByRole("button", { name: "Publish changes", exact: true }).click();
  await count(0);
  await page.screenshot({ path: ".visual-qa/editor-drafts/editor-desktop.png" });
  assert.equal(publishCalls, 2);
  assert.deepEqual(errors, []);
  console.log("PASS: mobile review, focus return/trapping, per-field undo, discard all, and publish confirmation/success/failure state (publication transport intercepted)");
} finally {
  for (const id of ids) {
    await db.execute("DELETE FROM audit_logs WHERE action = 'editor_draft_saved' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.draftId')) = ?", [id]);
    await db.execute("DELETE FROM saved_editor_drafts WHERE id = ?", [id]);
  }
  for (const hash of sessions) await db.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [hash]);
  await browser.close();
  await db.end();
}
