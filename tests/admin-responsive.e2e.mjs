// Local layout regression: no content, account, media, or publication writes.
// ADMIN_TEST_DB_SESSION=1 uses a temporary session for an existing local admin.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "C:/Users/RL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3001";
const output = process.env.RESPONSIVE_QA_OUTPUT || ".visual-qa/responsive";
const widths = [360, 390, 768, 1024, 1440];
const routes = ["login", "dashboard", "content", "settings/general", "settings/branding", "settings/contact", "settings/account", "settings/users", "editor"];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], report = [], unexpectedWrites = [];
let db, sessionHash;
await mkdir(output, { recursive: true });
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.dismiss());

async function checkLayout(state, containers = "") {
  const result = await page.evaluate((selector) => {
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
    const spills = selector ? [...document.querySelectorAll(selector)].filter(element => visible(element) && element.scrollWidth > element.clientWidth + 2 && !["auto", "scroll"].includes(getComputedStyle(element).overflowX)).map(element => ({ tag: element.tagName, class: element.className, width: element.clientWidth, scroll: element.scrollWidth })) : [];
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, spills };
  }, containers);
  assert.ok(result.scroll <= result.width, `${state}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.spills, [], `${state}: clipped content`);
  report.push({ state, ...result });
}
async function screenshot(name) { await page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" }); }
async function openSections(width) {
  if (width <= 900) await page.getByRole("button", { name: "Sections", exact: true }).click();
}
async function cancelPanel() { await page.getByRole("button", { name: "Close edit panel and keep changes", exact: true }).click(); }

try {
  if (process.env.ADMIN_TEST_DB_SESSION === "1") {
    require("@next/env").loadEnvConfig(process.cwd());
    db = await require("mysql2/promise").createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
    const [admins] = await db.execute("SELECT id FROM admin_profiles WHERE role='administrator' AND deleted_at IS NULL LIMIT 1");
    assert.ok(admins[0], "An existing administrator is required");
    const token = randomBytes(32).toString("base64url");
    sessionHash = createHash("sha256").update(token).digest("hex");
    await db.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE))", [sessionHash, admins[0].id]);
    await context.addCookies([{ name: "ganesh_admin_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
  } else {
    const access = await readFile(".local-setup/admin-access.txt", "utf8");
    await page.goto(`${origin}/login`);
    await page.getByLabel("Email address", { exact: true }).fill(access.match(/^Email: (.+)$/m)[1].trim());
    await page.getByLabel("Password", { exact: true }).fill(access.match(/^Temporary password: (.+)$/m)[1].trim());
    await page.getByRole("button", { name: "Sign in to Admin" }).click();
    await page.waitForURL("**/dashboard");
  }
  await page.route("**/api/**", route => {
    const request = route.request();
    if (request.url().endsWith("/api/media/sync")) return route.fulfill({ json: { added: 0 } });
    if (request.method() === "GET" || request.url().endsWith("/api/editor-preview")) return route.continue();
    unexpectedWrites.push(request.url());
    return route.fulfill({ status: 503, json: { error: "Writes disabled during responsive QA." } });
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`${origin}/${route}`, { waitUntil: "networkidle", timeout: 60000 });
      assert.equal(new URL(page.url()).pathname, `/${route}`, "The authenticated route must load");
      await page.evaluate(() => document.fonts.ready);
      if (route === "content") await page.locator(".cms-option-row").first().waitFor();
      if (route.startsWith("settings/")) await page.locator(".settings-card").first().waitFor();
      await checkLayout(`${route}-${width}`, ".settings-card,.team-form,.team-user,.cms-option-row,.ml-toolbar,.ml-grid,.ve-toolbar");
      await screenshot(`${route.replaceAll("/", "-")}-${width}`);

      if (route === "dashboard" && width <= 900) {
        const menu = page.getByRole("button", { name: "Open navigation" });
        const drawer = page.locator(".admin-sidebar");
        assert.equal(await drawer.evaluate(element => element.inert), true);
        await menu.click();
        await page.getByRole("dialog", { name: "Admin navigation" }).waitFor();
        assert.equal(await page.locator(".admin-main").evaluate(element => element.inert), true);
        await page.keyboard.press("Shift+Tab");
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Log out", "Focus wraps inside drawer");
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close navigation");
        await screenshot(`navigation-${width}`);
        await page.keyboard.press("Escape");
        assert.equal(await menu.evaluate(element => element === document.activeElement), true);
        await menu.click();
        await drawer.getByRole("button", { name: "Close navigation" }).click();
        await menu.click();
        await page.locator(".shell-backdrop").click({ position: { x: width - 5, y: 10 } });
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
      }
      if (route === "content") {
        await page.locator(".cms-option-row").first().scrollIntoViewIfNeeded();
        await screenshot(`order-options-${width}`);
        await page.getByRole("button", { name: "Save & Publish", exact: true }).click();
        await checkLayout(`content-publish-${width}`, ".cms-dialog");
        await screenshot(`content-publish-${width}`);
        await page.keyboard.press("Escape");
        await page.locator(".ml-card").first().click();
        await checkLayout(`media-details-${width}`, ".ml-dialog,.ml-details-overview");
        await screenshot(`media-details-${width}`);
        await page.getByRole("button", { name: "Close media dialog" }).click();
        await page.evaluate(() => document.querySelectorAll("details").forEach(element => { element.open = true; }));
        await checkLayout(`content-expanded-${width}`, ".cms-fields fieldset,.cms-item,.cms-group");
        const field = page.locator(".cms-field textarea").last();
        await field.scrollIntoViewIfNeeded();
        await screenshot(`nested-fields-${width}`);
      }
      if (route === "editor") {
        await page.waitForFunction(() => !document.querySelector(".ve-toolbar > button").disabled);
        for (const device of ["mobile", "tablet", "desktop"]) {
          await page.getByLabel("Screen size", { exact: true }).selectOption(device);
          await checkLayout(`editor-${device}-${width}`);
          const canvas = page.locator(".ve-canvas-area");
          assert.equal(await canvas.evaluate(element => getComputedStyle(element).overflowX), "auto");
        }
        for (const selectedPage of ["home", "products", "customize", "ourWork", "production"]) {
          await page.getByLabel("Page", { exact: true }).selectOption(selectedPage);
          await openSections(width);
          if (width <= 900) {
            await page.keyboard.press("Escape");
            assert.equal(await page.getByRole("button", { name: "Sections", exact: true }).evaluate(element => element === document.activeElement), true);
            await openSections(width);
          }
          await page.locator(".ve-section-row").first().getByRole("button", { name: "Edit Header and navigation", exact: true }).click();
          await page.locator(".ve-panel").waitFor();
          await checkLayout(`editor-panel-${selectedPage}-${width}`, ".ve-panel,.ve-panel fieldset");
          await screenshot(`editor-panel-${selectedPage}-${width}`);
          await cancelPanel();
        }
        await page.getByLabel("Page", { exact: true }).selectOption("home");
        for (const section of ["Edit Featured products · video & gallery", "Edit Fabrics", "Edit Order form", "Edit Size guide and questions"]) {
          await openSections(width);
          await page.getByRole("button", { name: section, exact: true }).click();
          await page.locator(".ve-panel").waitFor();
          await page.locator(".ve-panel").evaluate(element => element.querySelectorAll("details").forEach(details => { details.open = true; }));
          await checkLayout(`${section}-${width}`, ".ve-panel,.ve-panel fieldset");
          await screenshot(`${section.replaceAll(/[^a-z0-9]+/gi, "-")}-${width}`);
          await cancelPanel();
        }
        await page.getByRole("button", { name: "Save & Publish", exact: true }).click();
        await checkLayout(`editor-publish-${width}`, ".ve-dialog");
        await screenshot(`editor-publish-${width}`);
        await page.keyboard.press("Escape");
      }
    }
    console.log(`PASS: all admin routes, drawers, expanded forms, media and editor panels at ${width}px`);
  }
  // A short landscape viewport exercises the independently scrolling navigation.
  await page.setViewportSize({ width: 768, height: 360 });
  await page.goto(`${origin}/settings/account`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator(".sidebar-subnav a").last().scrollIntoViewIfNeeded();
  await screenshot("navigation-landscape");
  await page.locator(".admin-sidebar").getByRole("button", { name: "Close navigation" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.body.style.overflow !== "hidden" && !document.querySelector(".admin-main").inert && !document.querySelector(".admin-sidebar").inert);
  assert.deepEqual(unexpectedWrites, [], "Responsive validation must not change saved data");
  assert.deepEqual(errors, [], "No browser runtime errors");
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ widths, routes, checks: report, errors, unexpectedWrites }, null, 2));
  await browser.close();
  if (db) { if (sessionHash) await db.execute("DELETE FROM admin_sessions WHERE token_hash=?", [sessionHash]); await db.end(); }
}
