export function collectMediaIds(value: unknown): string[] {
  const result = new Set<string>();
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if ("assetId" in node && typeof node.assetId === "string") result.add(node.assetId);
    for (const child of Object.values(node)) walk(child);
  }
  walk(value);
  return [...result];
}

/** Canonicalize only our known media origins; unrelated hosts must never alias uploads. */
export function mediaUrlKey(value: string, origins: string[]): string {
  try {
    const url = new URL(value, "https://relative.invalid");
    if (url.origin === "https://relative.invalid" || origins.includes(url.origin)) return decodeURI(url.pathname);
    return url.href;
  } catch { return value; }
}

export function findMediaReferences(value: unknown, asset: { id: string; urls: string[] }, origins: string[] = []): string[] {
  const keys = new Set(asset.urls.map((url) => mediaUrlKey(url, origins)));
  const paths = new Set<string>();
  const matches = (url: string) => /^(\/|https?:\/\/)/i.test(url) && keys.has(mediaUrlKey(url, origins));
  function walk(node: unknown, path: string) {
    if (typeof node === "string" && matches(node)) paths.add(path);
    if (!node || typeof node !== "object") return;
    if (!Array.isArray(node) && "assetId" in node && node.assetId === asset.id) paths.add(path || "content");
    for (const [key, child] of Object.entries(node)) {
      if (key === "assetId") continue;
      if (key === "src" && typeof child === "string" && matches(child)) paths.add(path || "content");
      else walk(child, path ? `${path}.${key}` : key);
    }
  }
  walk(value, "");
  return [...paths];
}

export function collectMediaSources(value: unknown): { src: string; alt: string }[] {
  const sources = new Map<string, string>();
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if ("src" in node && typeof node.src === "string" && node.src && ("alt" in node || "kind" in node)) sources.set(node.src, "alt" in node ? String(node.alt || "") : "");
    for (const child of Object.values(node)) walk(child);
  }
  walk(value);
  return [...sources].map(([src, alt]) => ({ src, alt }));
}
