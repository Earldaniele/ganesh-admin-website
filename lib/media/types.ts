export type MediaUsageKind = "website" | "changes" | "history" | "backup" | "other";
export type MediaUsage = { location: string; path: string; kind?: MediaUsageKind; page?: string; section?: string };
export type LibraryMedia = {
  assetId: string; src: string; alt: string; filename: string; mimeType: string;
  size: number | null; uploadedAt: string | null; width: number | null; height: number | null;
  existing: boolean; usages: MediaUsage[];
};

export function mediaSelection(media: LibraryMedia, alt = "") {
  return { src: media.src, assetId: media.assetId, alt: alt.trim() || media.alt || media.filename.replace(/\.[^.]+$/, "") };
}
