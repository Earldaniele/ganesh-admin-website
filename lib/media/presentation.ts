import type { MediaUsage, MediaUsageKind } from "./types.ts";

const pages: Record<string, string> = { home: "Home", products: "Products", ourWork: "Our Work", production: "Production", customize: "Customize" };
const sections: Record<string, string> = {
  hero: "Introduction", image: "Main image", logo: "Logo", favicon: "Browser icon", socialPreview: "Sharing image",
  brandStatement: "About Ganesh", whatWeMake: "Product showcase", fabrics: "Fabrics", production: "Production",
  work: "Our Work", order: "Order form", values: "Our values", help: "Size guide and questions", footer: "Footer",
  productionHero: "Introduction image", customizeHero: "Introduction image", poster: "Video cover", video: "Video",
};
function at(content: unknown, path: string[]): unknown {
  return path.reduce<unknown>((node, key) => node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined, content);
}
function title(content: unknown, path: string[], fallback: string): string {
  const item = at(content, path);
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["name", "label", "title", "question"]) if (typeof record[key] === "string" && record[key].trim()) return record[key];
  }
  return fallback;
}
/** Resolve names against the reference's own snapshot, so reordering does not rename history. */
export function mediaPlacement(path: string, content?: unknown): { page: string; section: string } {
  const keys = path.split(".");
  const number = (key: string | undefined) => /^\d+$/.test(key ?? "") ? Number(key) + 1 : 1;
  if (keys[0] === "workCategories") {
    const category = title(content, keys.slice(0, 2), `Story ${number(keys[1])}`);
    const image = keys[2] === "tiles" ? title(content, keys.slice(0, 4), `Image ${number(keys[3])}`) : "Story";
    return { page: "Our Work", section: `${category} · ${image}` };
  }
  if (["products", "fabrics", "featuredProducts"].includes(keys[0])) {
    const featured = keys[0] === "featuredProducts", fabric = keys[0] === "fabrics";
    const item = title(content, keys.slice(0, 2), `${fabric ? "Fabric" : "Product"} ${number(keys[1])}`);
    const detail = keys[2] === "gallery" ? `Gallery · ${title(content, keys.slice(0, 4), `Image ${number(keys[3])}`)}` : sections[keys[2]] ?? "Image";
    return { page: featured ? "Home · Featured products" : fabric ? "Home and Products · Fabrics" : "Home and Products", section: `${item} · ${detail}` };
  }
  if (keys[0] === "global") return { page: "Across the website", section: sections[keys[1]] ?? "Website details" };
  if (keys[0] === "pages") return { page: pages[keys[1]] ?? "Website page", section: sections[keys[2]] ?? "Page content" };
  if (keys[0] === "editorial" && keys[1] === "images") return { page: keys[2] === "productionHero" ? "Production" : keys[2] === "customizeHero" ? "Customize" : "Website", section: sections[keys[2]] ?? "Page image" };
  if (keys[0] === "designMedia") return { page: "Website backup", section: "Saved images" };
  return { page: "Website", section: "Saved content" };
}
export function usageKind(usage: MediaUsage): MediaUsageKind {
  if (usage.path === "designMedia" || usage.path.startsWith("designMedia.")) return "backup";
  if (usage.kind) return usage.kind;
  if (/^Published\b/.test(usage.location)) return "website";
  if (/^(Draft\b|Current content\b)/.test(usage.location)) return "changes";
  if (/^Revision\b/.test(usage.location)) return "history";
  if (/^Website fallback\b/.test(usage.location)) return "backup";
  return "other";
}
export function groupMediaUsages(usages: MediaUsage[]) {
  const grouped: Record<MediaUsageKind, { page: string; sections: string[] }[]> = { website: [], changes: [], history: [], backup: [], other: [] };
  for (const usage of usages) {
    const kind = usageKind(usage);
    const placement = usage.page && usage.section ? { page: usage.page, section: usage.section } : mediaPlacement(usage.path);
    let group = grouped[kind].find((entry) => entry.page === placement.page);
    if (!group) { group = { page: placement.page, sections: [] }; grouped[kind].push(group); }
    if (!group.sections.includes(placement.section)) group.sections.push(placement.section);
  }
  return grouped;
}
export function deletionRestriction(usages: MediaUsage[], noun = "image"): string {
  const kinds = new Set(usages.map(usageKind));
  if (kinds.has("website")) return `This ${noun} is used on your website. Replace it there before deleting it.`;
  if (kinds.has("changes")) return `This ${noun} is selected in changes that are not live yet. Replace or remove it there before deleting it.`;
  if (kinds.has("backup")) return `This ${noun} is kept in a website backup and cannot be deleted. It helps keep your website available.`;
  if (kinds.has("history")) return `This ${noun} is kept in saved history and cannot be deleted. It is needed to restore earlier content.`;
  if (kinds.has("other")) return `This ${noun} is still needed by saved website content and cannot be deleted.`;
  return "";
}
export function fileTypeLabel(mime: string): string {
  const labels: Record<string, string> = { "image/webp": "WebP image", "image/jpeg": "JPEG image", "image/png": "PNG image", "image/svg+xml": "SVG image", "image/avif": "AVIF image", "image/gif": "GIF image", "image/x-icon": "Icon image", "image/vnd.microsoft.icon": "Icon image", "video/mp4": "MP4 video", "video/webm": "WebM video", "video/quicktime": "QuickTime video" };
  return labels[mime] ?? (mime.startsWith("video/") ? "Video" : mime.startsWith("image/") ? "Image" : "File");
}
export function uploadDateLabel(date: string | null): string {
  return date && Number.isFinite(new Date(date).getTime()) ? new Date(date).toLocaleString() : "Not available";
}
