import { test } from "node:test";
import assert from "node:assert/strict";
import { collectMediaSources, findMediaReferences, mediaUrlKey } from "../lib/content/media-references.ts";
import { mediaSelection, type LibraryMedia } from "../lib/media/types.ts";

const origins = ["http://localhost:3001", "http://localhost:3000"];
const asset = { id: "file-1", urls: ["http://localhost:3001/media/content/file.png", "http://localhost:3000/images/original.png"] };
test("references include asset IDs, legacy URL-only fields, query URLs and nested collections", () => {
  const content = { products: [{ image: { src: "/media/content/file.png?v=2", assetId: "file-1", alt: "Photo" } }], old: { src: "/images/original.png", alt: "Legacy" }, social: "http://localhost:3000/images/original.png" };
  assert.deepEqual(findMediaReferences(content, asset, origins), ["products.0.image", "old", "social"]);
});
test("unrelated remote hosts cannot alias local files or block deletion", () => {
  assert.deepEqual(findMediaReferences({ src: "https://unrelated.example/media/content/file.png" }, asset, origins), []);
  assert.equal(mediaUrlKey("http://localhost:3001/media/content/file.png?a=1", origins), "/media/content/file.png");
});
test("collect existing images and videos, excluding unrelated links and blank video fields", () => {
  assert.deepEqual(collectMediaSources({ image: { src: "/photo.webp", alt: "Picture" }, video: { kind: "video", src: "/movie.mp4", alt: "Movie" }, blank: { kind: "video", src: "", alt: "" }, link: { href: "/contact" } }), [{ src: "/photo.webp", alt: "Picture" }, { src: "/movie.mp4", alt: "Movie" }]);
});
test("library selections reuse stored IDs and URLs while keeping field-specific alt text", () => {
  const media = { assetId: "file-1", src: "/media/content/file.png", alt: "Library description", filename: "photo.png" } as LibraryMedia;
  assert.deepEqual(mediaSelection(media, "  Logo description  "), { assetId: "file-1", src: media.src, alt: "Logo description" });
  assert.equal(mediaSelection(media).alt, "Library description");
});
