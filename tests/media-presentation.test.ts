import { test } from "node:test";
import assert from "node:assert/strict";
import { deletionRestriction, fileTypeLabel, groupMediaUsages, mediaPlacement, uploadDateLabel } from "../lib/media/presentation.ts";
import { contentIssueSummary } from "../lib/content/presentation.ts";
import { adminMessage } from "../lib/admin-presentation.ts";

test("repeated saved versions never become extra live placements", () => {
  const path = "workCategories.3.tiles.1.image";
  const uses = ["Published 4 · private-project", "Draft 5 · private-project", ...Array.from({ length: 40 }, (_, index) => `Revision ${index} · private-project`)].map((location) => ({ location, path }));
  const grouped = groupMediaUsages(uses);
  assert.deepEqual(grouped.website, [{ page: "Our Work", sections: ["Story 4 · Image 2"] }]);
  assert.deepEqual(grouped.changes, grouped.website);
  assert.deepEqual(grouped.history, grouped.website);
  assert.equal(groupMediaUsages([{ location: "Published 4", path: "designMedia.HeroHeader.image" }]).website.length, 0);
  assert.doesNotMatch(JSON.stringify(grouped), /private-project|workCategories|Revision/);
});
test("names use each snapshot's own titles and support gallery, branding and interior pages", () => {
  const path = "workCategories.0.tiles.0.image";
  const content = { workCategories: [{ label: "Community", tiles: [{ title: "School uniforms" }] }] };
  const older = { workCategories: [{ label: "Events", tiles: [{ title: "Team shirts" }] }] };
  assert.deepEqual(mediaPlacement(path, content), { page: "Our Work", section: "Community · School uniforms" });
  assert.deepEqual(mediaPlacement(path, older), { page: "Our Work", section: "Events · Team shirts" });
  assert.deepEqual(mediaPlacement("global.logo"), { page: "Across the website", section: "Logo" });
  assert.deepEqual(mediaPlacement("editorial.images.productionHero"), { page: "Production", section: "Introduction image" });
  assert.deepEqual(mediaPlacement("featuredProducts.0.gallery.1.image"), { page: "Home · Featured products", section: "Product 1 · Gallery · Image 2" });
});
test("history, backups, unsaved and unknown uses all retain deletion restrictions", () => {
  for (const location of ["Published 1", "Draft 2", "Current content (including unsaved changes)", "Revision 1", "Website fallback · initial-content.json", "Unknown source"]) {
    assert.ok(deletionRestriction([{ location, path: "global.logo" }]));
  }
  assert.equal(deletionRestriction([]), "");
  assert.match(deletionRestriction([{ location: "Revision 1", path: "global.logo" }]), /saved history.*cannot be deleted/);
  assert.match(deletionRestriction([{ location: "Website fallback", path: "global.logo" }]), /website backup/);
  assert.match(deletionRestriction([{ location: "Published 1", path: "global.logo" }], "video"), /This video is used on your website/);
});
test("missing dates and uncommon file types remain readable", () => {
  assert.equal(uploadDateLabel(null), "Not available");
  assert.equal(uploadDateLabel("not-a-date"), "Not available");
  assert.equal(fileTypeLabel("image/webp"), "WebP image");
  assert.equal(fileTypeLabel("video/mp4"), "MP4 video");
  assert.equal(fileTypeLabel("image/unknown"), "Image");
});
test("validation and service errors explain the task without internal paths", () => {
  const message = contentIssueSummary([{ path: ["workCategories", 0, "tiles", 0, "image", "alt"], code: "too_small", minimum: 1, message: "Alt text is required" }], { workCategories: [{ label: "Schools", tiles: [{ title: "Uniforms" }] }] });
  assert.match(message, /Our Work · Schools · Uniforms · Image description/);
  assert.doesNotMatch(message, /workCategories|\.0\./);
  assert.doesNotMatch(adminMessage("MariaDB unavailable; run migration"), /MariaDB|migration/);
  assert.doesNotMatch(adminMessage("Conflicting copy controls: global.quoteLabel, designCopy.SiteHeader.buttonText"), /global\.|designCopy\./);
});
