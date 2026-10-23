// Run against the local admin app. All content writes are intercepted.
// TOAST_TEST_HARNESS=1 uses a temporary dev route and needs no database/login.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3001";
const harness = process.env.TOAST_TEST_HARNESS === "1";
const access = harness ? "" : await readFile(".local-setup/admin-access.txt", "utf8");
const path = (view) => harness ? `${origin}/toast-qa?view=${view}` : `${origin}/${view}`;
const fixture = JSON.parse(await readFile("lib/content/current-design.json", "utf8"));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
let writes = 0;
let version = 1;
let draft = fixture;
let failure = "";
let publicationFailure = false;
let refresh = true;
let releaseSave;
let saveStarted;
let holdSave = false;
let harnessCreated = false;
const toast = page.locator(".toast");
async function expectToast(message, tone = "success") {
  await page.locator(`.toast--${tone} .toast-message`).filter({ hasText: message }).waitFor();
  assert.equal(await toast.count(), 1);
  assert.equal(await page.locator(`.sr-only[role='${tone === "success" ? "status" : "alert"}']`).textContent(), message);
}
async function dismiss() {
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await toast.waitFor({ state: "detached" });
}
async function publish() {
  await page.getByRole("button", { name: "Save & Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish changes", exact: true }).click();
}
try {
  if (harness) {
    await mkdir("app/toast-qa", { recursive: true });
    await writeFile("app/toast-qa/page.tsx", `
import { ContentFields } from "@/components/ContentFields";
import VisualEditor from "@/components/VisualEditor";
import { SettingsClient } from "@/components/SettingsClient";
export default async function ToastQA({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return view === "editor" ? <VisualEditor /> : view === "settings/general" ? <SettingsClient section="general" /> : <ContentFields publicOrigin="http://localhost:3000" />;
}
`, { flag: "wx" });
    harnessCreated = true;
  }
  if (!harness) {
  await page.goto(`${origin}/login`, { timeout: 60000 });
  await page.getByLabel("Email address", { exact: true }).fill(access.match(/^Email: (.+)$/m)[1].trim());
  await page.getByLabel("Password", { exact: true }).fill(access.match(/^Temporary password: (.+)$/m)[1].trim());
  const login = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Sign in to Admin" }).click();
  const loginResponse = await login;
  assert.equal(loginResponse.ok(), true, (await loginResponse.json()).error || "Local test login failed");
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  console.log("PASS: authenticated local test session");
  }
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { displayName: "QA Admin", permissions: { publish: true, manageUsers: true } } }));
  await page.route("**/api/content", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { content: draft, version } });
    writes++;
    if (holdSave && method === "PUT") await new Promise((resolve) => { releaseSave = resolve; saveStarted(); });
    if (failure || (publicationFailure && method === "POST")) return route.fulfill({ status: 503, json: { error: failure || "Draft saved, but publishing failed." } });
    if (method === "PUT") { draft = route.request().postDataJSON().content; version++; }
    return route.fulfill({ json: { ok: true, content: draft, version, revalidated: refresh } });
  });
  await page.route("**/api/editor-preview", (route) => route.fulfill({ status: 503, json: { error: "Preview offline for isolated notification test." } }));
  await page.route("**/api/media?**", (route) => route.fulfill({ json: { assets: [], total: 0 } }));
  await page.route("**/api/media/sync", (route) => route.fulfill({ json: { ok: true } }));

  await page.goto(path("content"));
  const save = page.getByRole("button", { name: "Save Draft", exact: true });
  await save.waitFor();
  await page.waitForFunction(() => !document.querySelector(".cms-actions button").disabled);
  holdSave = true;
  const pendingSave = new Promise((resolve) => { saveStarted = resolve; });
  await save.evaluate((button) => { button.click(); button.click(); button.click(); });
  await pendingSave;
  await page.waitForFunction(() => document.querySelector(".cms-actions button").disabled);
  assert.equal(await toast.count(), 0, "Success must wait for the save response");
  assert.equal(writes, 1, "Rapid clicks must issue one request");
  releaseSave(); holdSave = false;
  await expectToast("Draft saved successfully.");
  const node = await toast.elementHandle();
  await save.click();
  await page.waitForFunction(() => !document.querySelector(".cms-actions button").disabled);
  assert.equal(await node.evaluate((element) => element === document.querySelector(".toast")), true, "Duplicate success must not remount or reset the toast");
  await page.mouse.move(0, 0);
  await toast.waitFor({ state: "detached", timeout: 5500 });
  console.log("PASS: confirmed saves, rapid-click guard, duplicate suppression, 4-second dismissal");

  failure = "The database is unavailable. Your edits have not been saved.";
  await save.click();
  await expectToast(failure, "error");
  await page.waitForTimeout(4300);
  assert.equal(await toast.count(), 1, "Errors remain available until dismissed");
  await dismiss(); failure = "";
  publicationFailure = true;
  await publish();
  await expectToast("Draft saved, but publishing failed.", "error");
  assert.equal(await page.locator(".toast--success").count(), 0);
  await dismiss(); publicationFailure = false; refresh = false;
  await publish();
  await expectToast("Published successfully.");
  await page.getByRole("button", { name: "Retry public refresh" }).waitFor();
  await dismiss();
  console.log("PASS: save failure, partial publish failure, successful publication with refresh retry");

  await page.goto(path("editor"));
  await page.getByRole("button", { name: "Edit Hero / introduction", exact: true }).click();
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expectToast("Changes applied successfully.");
  await dismiss();
  await page.getByRole("button", { name: "Edit Featured products · video & gallery", exact: true }).click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expectToast("Changes saved successfully.");
  const desktop = await toast.boundingBox();
  const toolbar = await page.locator(".ve-status").boundingBox();
  assert.ok(desktop.y >= toolbar.y + toolbar.height, "Toast must clear editor save controls");
  await mkdir(".visual-qa", { recursive: true });
  await page.screenshot({ path: ".visual-qa/toast-desktop.png", animations: "disabled" });
  await dismiss();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expectToast("Draft saved successfully.");
  const mobile = await toast.boundingBox();
  const mobileToolbar = await page.locator(".ve-status").boundingBox();
  assert.ok(mobile.x >= 0 && mobile.x + mobile.width <= 390);
  assert.ok(mobile.y >= mobileToolbar.y + mobileToolbar.height);
  await page.screenshot({ path: ".visual-qa/toast-mobile.png", animations: "disabled" });
  await page.getByRole("button", { name: "Dismiss notification" }).focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(4300);
  assert.equal(await toast.count(), 1, "Keyboard focus must pause dismissal");
  await dismiss();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expectToast("Draft saved successfully.");
  assert.ok(await toast.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration) < .01));
  await dismiss();
  console.log("PASS: apply/save changes, desktop/mobile placement, keyboard pause, reduced motion");

  await page.goto(path("settings/general"));
  await page.getByLabel("Business name").waitFor();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expectToast("Changes saved successfully.");
  await dismiss();
  failure = "Could not save settings. Please try again.";
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expectToast(failure, "error");
  assert.deepEqual(errors, []);
  console.log("PASS: settings success/error feedback; no browser runtime errors");
} finally {
  releaseSave?.();
  await browser.close();
  if (harnessCreated) {
    await unlink("app/toast-qa/page.tsx");
    await rmdir("app/toast-qa");
  }
}
