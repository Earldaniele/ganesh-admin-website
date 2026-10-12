import sharp from "sharp";
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
/** Accept bounded, structurally complete ISO base media MP4 containers. */
export function validateVideo(bytes: Buffer, declaredMime: string) {
  if (declaredMime !== "video/mp4" || !bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error("Choose an MP4 video up to 32 MB.");
  let offset = 0;
  const boxes = new Set<string>();
  while (offset < bytes.length) {
    if (bytes.length - offset < 8) throw new Error("Incomplete MP4 container.");
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (bytes.length - offset < 16) throw new Error("Incomplete MP4 box.");
      const large = bytes.readBigUInt64BE(offset + 8);
      if (large > BigInt(bytes.length)) throw new Error("Invalid MP4 box size.");
      size = Number(large); header = 16;
    } else if (size === 0) size = bytes.length - offset;
    if (size < header || offset + size > bytes.length) throw new Error("Invalid MP4 container.");
    boxes.add(type); offset += size;
  }
  if (bytes.toString("ascii", 4, 8) !== "ftyp" || !boxes.has("moov") || !boxes.has("mdat")) throw new Error("Use a complete MP4 video with media and playback metadata.");
  return { bytes, extension: "mp4", mime: "video/mp4", width: null, height: null };
}
const types: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

/** Fully decode and re-encode uploads; never serve original active SVG markup. */
export async function validateImage(bytes: Buffer, declaredMime: string) {
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) throw new Error("Images must be 5 MB or smaller.");
  if (!Object.values(types).includes(declaredMime)) throw new Error("Use PNG, JPEG, WebP or SVG.");
  if (declaredMime === "image/svg+xml") {
    const xml = bytes.toString("utf8");
    // No entities, scripts, foreign markup, external resources, imports or animation.
    if (!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(xml) || /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|image|use|animate|set)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|@import|javascript:|data:/i.test(xml)) throw new Error("SVG must contain only self-contained static artwork.");
  }
  const pipeline = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning", animated: false });
  const metadata = await pipeline.metadata();
  if (!metadata.format || types[metadata.format] !== declaredMime) throw new Error("Image contents do not match the declared MIME type.");
  if (!metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000 || (metadata.pages ?? 1) > 1) throw new Error("Use a single image with dimensions no greater than 10000 pixels.");
  const output = metadata.format === "svg" || metadata.format === "png" ? pipeline.png() : metadata.format === "jpeg" ? pipeline.jpeg({ quality: 95 }) : pipeline.webp({ quality: 95 });
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  if (data.length > MAX_MEDIA_BYTES) throw new Error("Processed image exceeds 5 MB. Please resize it before uploading.");
  return { bytes: data, mime: types[info.format], extension: info.format === "jpeg" ? "jpg" : info.format, width: info.width, height: info.height };
}
