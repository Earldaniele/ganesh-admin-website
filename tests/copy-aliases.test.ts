import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCopyAliases } from "../lib/content/copy-aliases.ts";
const before = { global: { quoteLabel: "legacy" }, designCopy: { SiteHeader: { buttonText: "design", buttonText3: "mobile" }, SiteFooter: { description3: "legal design" } }, pages: { home: { footer: { legal: "legal legacy" } } } };
test("untouched differing saved copy survives unrelated edits", () => { assert.deepEqual(reconcileCopyAliases(before, before).content, before); });
test("deliberate legacy edit reconciles both desktop and mobile without mutating the original", () => { const next = structuredClone(before); next.global.quoteLabel = "Request estimate"; const result = reconcileCopyAliases(before, next); assert.equal(result.content.designCopy.SiteHeader.buttonText, "Request estimate"); assert.equal(result.content.designCopy.SiteHeader.buttonText3, "Request estimate"); assert.equal(before.designCopy.SiteHeader.buttonText, "design"); assert.equal(result.reconciledFields.length, 2); });
test("conflicting simultaneous aliases reject without discarding values", () => { const next = structuredClone(before); next.global.quoteLabel = "one"; next.designCopy.SiteHeader.buttonText = "two"; assert.throws(() => reconcileCopyAliases(before, next), /Conflicting/); });
test("design legal edit updates compatibility control", () => { const next = structuredClone(before); next.designCopy.SiteFooter.description3 = "Reviewed legal"; assert.equal(reconcileCopyAliases(before, next).content.pages.home.footer.legal, "Reviewed legal"); });
