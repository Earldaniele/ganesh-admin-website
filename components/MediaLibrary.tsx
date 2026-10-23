"use client";
import { adminMessage } from "@/lib/admin-presentation";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { uploadMedia, imageUploadError } from "@/lib/media/upload";
import { findMediaReferences } from "@/lib/content/media-references";
import { mediaSelection, type LibraryMedia } from "@/lib/media/types";
import { refreshMedia } from "@/lib/media/refresh";
import { deletionRestriction, fileTypeLabel, groupMediaUsages, mediaPlacement, uploadDateLabel } from "@/lib/media/presentation";
import "./media-library.css";

function Dialog({ title, onClose, children, compact = false }: { title: string; onClose: () => void; children: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={ref} className={`ml-dialog${compact ? " ml-dialog-details" : ""}`} aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }}><header><h2 id={id}>{title}</h2><button type="button" aria-label="Close media dialog" onClick={onClose}>×</button></header><div className="ml-dialog-body">{children}</div></dialog>;
}
const bytesLabel = (size: number | null) => size === null ? "Not available" : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
function UsageList({ groups }: { groups: ReturnType<typeof groupMediaUsages>["website"] }) {
  return <ul className="ml-usages">{groups.map((group) => <li key={group.page}><strong>{group.page}</strong><ul>{group.sections.map((section) => <li key={section}>{section}</li>)}</ul></li>)}</ul>;
}
function MediaPreview({ item, large = false }: { item: LibraryMedia; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="ml-preview-error" role={large ? "alert" : undefined}>Preview unavailable. The file may be missing, or its format may not play in this browser.</p>;
  return item.mimeType.startsWith("video/") ? <video src={item.src} controls={large} muted={!large} playsInline preload="metadata" aria-label={item.alt || item.filename} onError={() => setFailed(true)} /> : <img src={item.src} alt={item.alt || item.filename} loading={large ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}
let initialSync: Promise<void> | undefined;
async function sync() {
  const response = await fetch("/api/media/sync", { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not refresh website media. Please try again.");
}
type Props = { type?: "all" | "image" | "video"; onSelect?: (media: ReturnType<typeof mediaSelection>) => void; currentContent?: unknown; publicOrigin?: string };
export function MediaLibrary({ type = "all", onSelect, currentContent, publicOrigin = "" }: Props) {
  const [media, setMedia] = useState<LibraryMedia[]>([]), [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState(type), [limit, setLimit] = useState(36);
  const [selected, setSelected] = useState<LibraryMedia | null>(null), [alt, setAlt] = useState("");
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [confirmDelete, setConfirmDelete] = useState(false);
  const operation = useRef(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/media", { cache: "no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Cannot load Media Library.");
    setMedia(data.media);
  }, []);
  useEffect(() => {
    let active = true;
    initialSync ??= sync().catch((failure) => { initialSync = undefined; throw failure; });
    const pendingSync = initialSync;
    void refreshMedia(() => pendingSync, load).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  // Include unsaved selections in this Content Fields session as well as saved references.
  const usages = selected ? [...selected.usages, ...findMediaReferences(currentContent, { id: selected.assetId, urls: [selected.src] }, [typeof window === "undefined" ? "" : window.location.origin, publicOrigin]).map((path) => ({ location: "Current content (including unsaved changes)", path, kind: "changes" as const, ...mediaPlacement(path, currentContent) }))] : [];
  const grouped = groupMediaUsages(usages);
  const restriction = deletionRestriction(usages, selected?.mimeType.startsWith("video/") ? "video" : "image");
  const visible = media.filter((item) => (type === "all" || item.mimeType.startsWith(`${type}/`)) && (filter === "all" || item.mimeType.startsWith(`${filter}/`)) && `${item.filename} ${item.alt} ${item.mimeType}`.toLowerCase().includes(search.toLowerCase()));
  async function upload(files: File[]) {
    if (operation.current || !files.length) return;
    if (files.length > 50) { setError("Upload up to 50 files at a time."); return; }
    operation.current = true; setBusy(true); setError(""); let successes = 0;
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setStatus(`Uploading ${index + 1}/${files.length}: ${file.name}`); setProgress(0);
        const invalid = file.type === "video/mp4" ? (!file.size || file.size > 32 * 1024 * 1024 ? "Use an MP4 up to 32 MB." : null) : imageUploadError(file);
        if (invalid) { failures.push(`${file.name}: ${invalid}`); continue; }
        try { await uploadMedia(file, (file.name.replace(/\.[^.]+$/, "") || "Media file").slice(0, 300), setProgress); successes++; }
        catch (failure) { failures.push(`${file.name}: ${failure instanceof Error ? failure.message : "Upload failed."}`); }
      }
      await load(); setStatus(`${successes} of ${files.length} files uploaded and saved to Media Library.`); setError(failures.join("\n"));
    } catch (failure) { setError(`${successes} files stored. ${failure instanceof Error ? failure.message : "Refresh to reload the library."}`); }
    finally { operation.current = false; setBusy(false); }
  }
  async function remove() {
    if (!selected || busy || operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/media/${selected.assetId}`, { method: "DELETE" }); const result = await response.json();
      if (!response.ok) { if (result.usages) setSelected({ ...selected, usages: result.usages }); throw new Error(result.usages?.length ? deletionRestriction(result.usages, selected.mimeType.startsWith("video/") ? "video" : "image") : result.error || "Deletion failed."); }
      setSelected(null); setConfirmDelete(false); setStatus(result.cleanupPending ? "Media removed from the library. File removal is still finishing; contact your administrator if you need help." : result.externalSourceRetained ? "Media removed from the library. The original file is still available on the website where it is hosted." : "Media permanently deleted."); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Deletion failed."); setConfirmDelete(false); }
    finally { operation.current = false; setBusy(false); }
  }
  const preview = (item: LibraryMedia, large = false) => <MediaPreview key={item.assetId} item={item} large={large} />;
  return <section className="ml-library" aria-label="Media Library" aria-busy={loading || busy}>
    <div className="ml-heading"><div><p>Website images and videos</p><h2>Media Library</h2><span>Upload and reuse pictures and videos. Your website changes when you publish.</span></div><label className="ml-upload">{busy ? "Uploading…" : "Upload media"}<input aria-label="Upload media files" type="file" multiple disabled={busy || loading} accept={type === "video" ? "video/mp4" : type === "image" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp,image/svg+xml,video/mp4"} onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} /></label></div>
    <p className="ml-hint">PNG, JPG, WebP or static SVG up to 5 MB · MP4 up to 32 MB · Multiple files supported. Review image descriptions when selecting media.</p>
    <div className="ml-toolbar"><label>Search media<input type="search" value={search} placeholder="Filename or description" onChange={(event) => { setSearch(event.target.value); setLimit(36); }} /></label><div className="ml-filters" role="group" aria-label="Media type">{([['all', 'All Media'], ['image', 'Images'], ['video', 'Videos']] as const).filter(([key]) => type === "all" || key === type).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(36); }}>{label}</button>)}</div><button type="button" disabled={busy || loading} onClick={async () => { setLoading(true); setError(""); try { await refreshMedia(sync, load); setStatus("Media Library refreshed."); } catch (failure) { setError(String(failure)); } finally { setLoading(false); } }}>Refresh library</button></div>
    {busy ? <progress max={100} value={progress} aria-label="Media upload progress" /> : null}{status ? <p role="status">{status}</p> : null}{error ? <p className="ml-error" role="alert">{adminMessage(error)}</p> : null}
    {loading ? <p role="status">Loading and checking existing website media…</p> : <><p className="ml-hint">{visible.length} files</p><div className="ml-grid">{visible.slice(0,limit).map((item) => <button type="button" className="ml-card" key={item.assetId} onClick={() => { setError(""); setSelected(item); setAlt(item.alt || item.filename.replace(/\.[^.]+$/, "")); setConfirmDelete(false); }}><div className="ml-thumb">{preview(item)}<span>{item.mimeType.startsWith("video/") ? "Video ▶" : "Image"}</span></div><strong>{item.filename}</strong><small>{bytesLabel(item.size)}</small></button>)}</div>{!visible.length ? <p>No media matches. Try another search or upload a file.</p> : null}{visible.length > limit ? <button type="button" onClick={() => setLimit(limit + 36)}>Show more media</button> : null}</>}
    {selected ? <Dialog compact title={onSelect ? "Select media" : "Media details"} onClose={() => { if (!busy) setSelected(null); }}>
      <div className="ml-details-overview"><div className="ml-preview">{preview(selected, true)}</div><dl className="ml-file-info"><div><dt>Filename</dt><dd>{selected.filename}</dd></div><div><dt>File type</dt><dd>{fileTypeLabel(selected.mimeType)}</dd></div><div><dt>File size</dt><dd>{bytesLabel(selected.size)}</dd></div><div><dt>Upload date</dt><dd>{uploadDateLabel(selected.uploadedAt)}</dd></div>{selected.width && selected.height ? <div><dt>Dimensions</dt><dd>{selected.width} × {selected.height} pixels</dd></div> : null}</dl></div>
      <section className="ml-usage-section"><h3>On your website</h3>{grouped.website.length ? <UsageList groups={grouped.website} /> : <p className="ml-hint">Not currently used on the live website.</p>}</section>
      {grouped.changes.length ? <section className="ml-usage-section"><h3>Unpublished changes</h3><p className="ml-hint">Selected in saved or open edits. These selections may not be live yet.</p><UsageList groups={grouped.changes} /></section> : null}
      {grouped.history.length || grouped.backup.length || grouped.other.length ? <details className="ml-history"><summary>Saved history and backups</summary><p className="ml-hint">These copies are kept for recovery and are separate from current website use. This file stays protected even after you replace it on the website.</p>{grouped.history.length ? <><h4>Earlier content</h4><UsageList groups={grouped.history} /></> : null}{grouped.backup.length ? <><h4>Website backup</h4><UsageList groups={grouped.backup} /></> : null}{grouped.other.length ? <><h4>Other saved content</h4><UsageList groups={grouped.other} /></> : null}</details> : null}
      {onSelect ? <div className="ml-details-actions"><label className="ml-description">{selected.mimeType.startsWith("image/") ? "Image description (alt text)" : "Video description"}<input value={alt} maxLength={300} aria-describedby="ml-description-help" onChange={(event) => setAlt(event.target.value)} /></label><p className="ml-hint" id="ml-description-help">Describe what is shown for people who cannot see it.</p><button className="ml-primary" type="button" disabled={!alt.trim() || busy} onClick={() => onSelect(mediaSelection(selected, alt))}>Use selected media</button></div> : <div className="ml-details-actions">{restriction ? <p id="ml-delete-reason" className="ml-deletion-note">{restriction}</p> : <p className="ml-hint">This file is not used in website content or saved history.</p>}{confirmDelete ? <div role="group" aria-label="Confirm permanent deletion"><p>Permanently delete {selected.filename}? This cannot be undone.</p><div className="ml-action-row"><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" disabled={busy || usages.length > 0} onClick={() => void remove()}>Delete permanently</button></div></div> : <button type="button" aria-describedby={restriction ? "ml-delete-reason" : undefined} disabled={busy || usages.length > 0} onClick={() => setConfirmDelete(true)}>Delete media</button>}</div>}
      {error ? <p className="ml-error" role="alert">{adminMessage(error)}</p> : null}
    </Dialog> : null}
  </section>;
}

export function MediaPicker({ type, onSelect }: { type: "image" | "video"; onSelect: (media: ReturnType<typeof mediaSelection>) => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Choose from Media Library</button>{open ? <Dialog title={type === "image" ? "Choose an image" : "Choose a video"} onClose={() => setOpen(false)}><MediaLibrary type={type} onSelect={(media) => { onSelect(media); setOpen(false); }} /></Dialog> : null}</>;
}
