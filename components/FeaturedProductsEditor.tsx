"use client";
import { useState } from "react";
import type { ContentSnapshot } from "@/lib/content/schema";
import { imageUploadError, uploadMedia } from "@/lib/media/upload";
import { EditorFields, MediaField, VideoField, type EditorFieldsProps } from "./EditorFields";

type Product = NonNullable<ContentSnapshot["featuredProducts"]>[number];
type Props = Omit<EditorFieldsProps, "name" | "value" | "onChange"> & { value: Product[]; onChange: (products: Product[]) => void };

export function FeaturedProductsEditor(props: Props) {
  const [selected, setSelected] = useState(props.value[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const product = props.value.find((p) => p.id === selected) ?? props.value[0];
  if (!product) return <p>No featured products configured.</p>;
  const change = (next: Product) => props.onChange(props.value.map((p) => p.id === product.id ? next : p));
  async function uploadGallery(files: File[]) {
    if (busy || !files.length) return;
    setError(""); setMessage("");
    if (product.gallery.length + files.length > 30) { setError("Keep at most 30 gallery images per product."); return; }
    for (const file of files) { const invalid = imageUploadError(file); if (invalid) { setError(`${file.name}: ${invalid}`); return; } }
    setBusy(true); props.onBusy(true);
    const gallery = [...product.gallery];
    try {
      for (const [index, file] of files.entries()) {
        setMessage(`Uploading image ${index + 1} of ${files.length}: ${file.name}`);
        const label = file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Product image";
        const media = await uploadMedia(file, `${product.name}: ${label}`.slice(0, 300), setProgress);
        gallery.push({ id: crypto.randomUUID(), label, image: media });
        change({ ...product, gallery: [...gallery] });
      }
      setMessage(`${files.length} images uploaded. Review their captions and alt text, then Save Changes.`);
    } catch (failure) { setMessage(""); setError(`${failure instanceof Error ? failure.message : "Upload failed."} ${gallery.length - product.gallery.length} images added; retry the remaining files.`); }
    finally { setBusy(false); props.onBusy(false); }
  }
  return <div className="ve-featured-editor">
    <label>Featured product<select value={product.id} disabled={busy} onChange={(e) => { setSelected(e.target.value); setError(""); setMessage(""); }}>{props.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <EditorFields {...props} name="Product text" value={Object.fromEntries(Object.entries(product).filter(([key]) => !["video", "gallery", "poster", "image"].includes(key)))} onChange={(next) => change({ ...product, ...next as Partial<Product> })} />
    <fieldset><legend>Product video</legend><VideoField key={product.id} value={product.video} publicOrigin={props.publicOrigin} onBusy={props.onBusy} onChange={(video) => change({ ...product, video: video as Product["video"] })} /></fieldset>
    <fieldset><legend>Image gallery · {product.gallery.length}/30</legend>
      <label className="ve-file">Add multiple images · up to 5 MB each<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={busy} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadGallery(files); }} /></label>
      {busy ? <progress aria-label="Gallery upload progress" max={100} value={progress} /> : null}
      {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
      <p>Keep at least one image for the public fallback. Removing an image here retains its stored file and revision history.</p>
      {product.gallery.map((item, index) => <section className="ve-gallery-item" key={item.id}>
        <label>Image caption<input maxLength={160} value={item.label} onChange={(e) => change({ ...product, gallery: product.gallery.map((g) => g.id === item.id ? { ...g, label: e.target.value } : g) })} /></label>
        <MediaField value={item.image} publicOrigin={props.publicOrigin} onBusy={props.onBusy} onChange={(image) => change({ ...product, gallery: product.gallery.map((g) => g.id === item.id ? { ...g, image: image as Product["image"] } : g) })} />
        <div className="ve-item-actions"><button type="button" disabled={!index} onClick={() => { const gallery = [...product.gallery]; [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]]; change({ ...product, gallery }); }}>Move up</button><button type="button" disabled={index === product.gallery.length - 1} onClick={() => { const gallery = [...product.gallery]; [gallery[index + 1], gallery[index]] = [gallery[index], gallery[index + 1]]; change({ ...product, gallery }); }}>Move down</button><button type="button" disabled={product.gallery.length <= 1} onClick={() => props.requestRemove(item.label, item, () => change({ ...product, gallery: product.gallery.filter((g) => g.id !== item.id) }))}>Remove image</button></div>
      </section>)}
    </fieldset>
    <EditorFields {...props} name="Video poster image" value={product.poster} onChange={(poster) => change({ ...product, poster: poster as Product["poster"] })} />
    <EditorFields {...props} name="Product image" value={product.image} onChange={(image) => change({ ...product, image: image as Product["image"] })} />
  </div>;
}
