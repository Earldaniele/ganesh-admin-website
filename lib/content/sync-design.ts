import { initialContent } from "./seed.ts";
import { parseContentSnapshot } from "./schema.ts";

/** Fill only absent fields; arrays merge by stable ID, never replace private copy. */
export function mergeMissingDesign(existing: unknown, current: unknown): unknown {
  if (existing === undefined) return structuredClone(current);
  if (Array.isArray(existing) && Array.isArray(current)) {
    return existing.map((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return item;
      const source = current.find((value) => value && typeof value === "object" && value.id === item.id);
      return source ? mergeMissingDesign(item, source) : item;
    });
  }
  if (existing && current && typeof existing === "object" && typeof current === "object" && !Array.isArray(existing) && !Array.isArray(current)) {
    const next = { ...existing } as Record<string, unknown>;
    for (const [key, value] of Object.entries(current)) next[key] = mergeMissingDesign(next[key], value);
    return next;
  }
  return existing;
}
export function syncCurrentDesign(value: unknown) {
  // Merge raw JSON before parsing: validation must not discard newly imported keys.
  return parseContentSnapshot(mergeMissingDesign(value, initialContent));
}
