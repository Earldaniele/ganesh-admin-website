const retainedLegacy = new Set([
  "pages.products.heroCaption", "pages.products.buildOrder", "pages.products.specialRequest",
  "editorial.labels.header.support", "editorial.labels.header.supportHeading", "editorial.labels.header.trackOrder", "editorial.labels.header.visit",
  "editorial.labels.sections.fabricDisclaimer",
]);
export function legacyFieldNotice(path: string): string | null {
  if (path === "designMedia" || path.startsWith("designMedia.")) return "Retained design-import backup. Edit the canonical page image, Global logo or Editorial images instead. This backup has no public binding and remains saved unchanged.";
  if (/^fabrics\.\d+\.qualities(?:\.|$)/.test(path)) return "Retained legacy fabric qualities. The current detail card uses Benefits; edit that collection instead. Existing qualities remain saved unchanged.";
  if (/^workCategories\.\d+\.tiles\.\d+\.description$/.test(path)) return "Retained portfolio description. The current tile displays its title and image; this legacy copy remains saved unchanged.";
  if (/^workCategories\.\d+\.story\.orderLabel$/.test(path)) return "Retained legacy complete action label. The current portfolio action uses Design copy fragments; this value remains saved unchanged.";
  return retainedLegacy.has(path) ? "Retained legacy value: this control has no section in the current public design. It is read-only; its saved content is preserved. Use the corresponding current page/design copy controls." : null;
}
