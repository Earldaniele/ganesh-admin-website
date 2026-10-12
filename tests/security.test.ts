import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { isSameOrigin, readJson } from "../lib/auth/request.ts";
import { validateImage, MAX_MEDIA_BYTES } from "../lib/media/validate.ts";

test("password hashes are salted, verified and bounded", async () => {
  const password = " Strong test password 12 ";
  const hash = await hashPassword(password);
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password.trim(), hash), false);
  assert.equal(await verifyPassword(password, "scrypt$x$00"), false);
  await assert.rejects(hashPassword("short"));
});
test("cookie writes reject absent and cross-site origins", () => {
  const origin = process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001";
  const url = `${origin}/api/content`;
  assert.equal(isSameOrigin(new Request(url)), false);
  assert.equal(isSameOrigin(new Request(url, { headers: { origin: "https://other.test" } })), false);
  assert.equal(isSameOrigin(new Request(url, { headers: { origin } })), true);
  assert.equal(isSameOrigin(new Request(url, { headers: { origin, "sec-fetch-site": "cross-site" } })), false);
});
test("JSON request limits are enforced without trusting Content-Length", async () => {
  await assert.rejects(readJson(new Request("http://localhost/test", { method: "POST", body: JSON.stringify({ big: "x".repeat(1000) }) }), 20));
});
test("uploads decode real image bytes and preserve dimensions", async () => {
  const png = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#ae2433" } }).png().toBuffer();
  const image = await validateImage(png, "image/png");
  assert.equal(image.width, 16); assert.equal(image.height, 12);
  await assert.rejects(validateImage(png, "image/jpeg"));
  await assert.rejects(validateImage(Buffer.from("not a PNG"), "image/png"));
  await assert.rejects(validateImage(Buffer.alloc(MAX_MEDIA_BYTES + 1), "image/png"));
});
test("SVG is rasterized; scripts, external resources and entity payloads are rejected", async () => {
  const image = await validateImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'), "image/svg+xml");
  assert.equal(image.mime, "image/png");
  for (const payload of ['<svg onload="alert(1)"></svg>', '<svg><script>alert(1)</script></svg>', '<svg><image href="http://127.0.0.1"/></svg>', '<!DOCTYPE svg><svg/>']) await assert.rejects(validateImage(Buffer.from(payload), "image/svg+xml"));
});
