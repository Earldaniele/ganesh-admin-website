// Canonical design controls and their retained compatibility controls.
export const copyAliasGroups = [
  ["designCopy.SiteHeader.buttonText", "global.quoteLabel", "designCopy.SiteHeader.buttonText3"],
  ["designCopy.SiteFooter.description3", "pages.home.footer.legal"],
] as const;
type ObjectValue = Record<string, unknown>;
function at(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as ObjectValue)[key] : undefined, value);
}
function put(value: ObjectValue, path: string, text: unknown) {
  const keys = path.split("."); let current = value;
  for (const key of keys.slice(0, -1)) current = (current[key] ??= {}) as ObjectValue;
  current[keys.at(-1)!] = text;
}
/** Never normalize untouched disagreements. A deliberate edit updates its aliases;
 * conflicting simultaneous edits are rejected so no author's value is discarded. */
export function reconcileCopyAliases<T>(previous: T, submitted: T): { content: T; reconciledFields: string[] } {
  const content = structuredClone(submitted), reconciledFields: string[] = [];
  for (const group of copyAliasGroups) {
    const changed = group.filter(path => at(previous, path) !== at(submitted, path));
    if (!changed.length) continue;
    const values = new Set(changed.map(path => at(submitted, path)));
    if (values.size > 1) throw new Error(`Conflicting copy controls: ${changed.join(", ")}. Use the same text for these linked controls.`);
    for (const path of group) {
      if (at(content, path) !== at(submitted, changed[0])) {
        put(content as ObjectValue, path, at(submitted, changed[0])); reconciledFields.push(path);
      }
    }
  }
  return { content, reconciledFields };
}
