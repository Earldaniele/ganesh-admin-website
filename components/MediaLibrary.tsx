"use client";
import { adminMessage } from "@/lib/admin-presentation";
/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { uploadMedia, imageUploadError } from "@/lib/media/upload";
import { findMediaReferences } from "@/lib/content/media-references";
import { mediaSelection, type LibraryMedia } from "@/lib/media/types";
import { deletionRestriction, fileTypeLabel, groupMediaUsages, mediaPlacement, uploadDateLabel } from "@/lib/media/presentation";
import { Icon } from "./Icon";
import "./media-library.css";
function Dialog({ title, onClose, children, footer, compact = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={ref} className={`ml-dialog${compact ? " ml-dialog-details" : ""}`} aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }}><header><h2 id={id}>{title}</h2><button type="button" aria-label="Close media dialog" onClick={onClose}><Icon name="x" /></button></header><div className="ml-dialog-body">{children}</div>{footer ? <footer className="ml-dialog-footer">{footer}</footer> : null}</dialog>;
}
const bytesLabel = (size: number | null) => size === null ? "Not available" : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
function UsageList({ groups }: { groups: ReturnType<typeof groupMediaUsages>["website"] }) {
  return <ul className="ml-usages">{groups.map((group) => <li key={group.page}><strong>{group.page}</strong><ul>{group.sections.map((section) => <li key={section}>{section}</li>)}</ul></li>)}</ul>;
}
function MediaPreview({ item, large = false }: { item: LibraryMedia; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="ml-preview-error" role={large ? "alert" : undefined}>Preview unavailable. The file may be missing, or its format may not play in this browser.</p>;
  if (!large && !item.thumbnail) return <span>{item.mimeType.startsWith("video/") ? "Video · Open to preview" : "Open to preview"}</span>;
  return item.mimeType.startsWith("video/") ? <video src={item.src} controls={large} muted={!large} playsInline preload="metadata" aria-label={item.alt || item.filename} onError={() => setFailed(true)} /> : <img src={large ? item.src : item.thumbnail} alt={item.alt || item.filename} loading={large ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />;
}
let pendingSync: Promise<void> | undefined;
function sync() {
  if (pendingSync) return pendingSync;
  pendingSync = discover().finally(() => { pendingSync = undefined; });
  return pendingSync;
}
async function discover() {
  const response = await fetch("/api/media/sync", { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not refresh website media. Please try again.");
  if (result.running) {
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const check = await fetch("/api/media/sync", { cache: "no-store" }), state = await check.json();
      if (!check.ok) throw new Error(state.error || "Could not check website media discovery.");
      if (!state.running) return;
    }
    throw new Error("Website media discovery is still running. Refresh the library shortly.");
  }
}
export const MediaContentContext = createContext<{ content?: unknown; publicOrigin?: string }>({});
type Props = { type?: "all" | "image" | "video"; onSelect?: (media: ReturnType<typeof mediaSelection>) => void; currentContent?: unknown; publicOrigin?: string };
export function MediaLibrary({ type = "all", onSelect, currentContent: suppliedContent, publicOrigin: suppliedOrigin }: Props) {
  const context = useContext(MediaContentContext);
  const currentContent = suppliedContent ?? context.content, publicOrigin = suppliedOrigin ?? context.publicOrigin ?? "";
  const [media, setMedia] = useState<LibraryMedia[]>([]), [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [filter, setFilter] = useState(type), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<LibraryMedia | null>(null), [alt, setAlt] = useState("");
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(true), [usageLoading, setUsageLoading] = useState(false), [usageError, setUsageError] = useState("");
  const operation = useRef(false);
  const listRequest = useRef(0), listController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const request = ++listRequest.current;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    try {
      const response = await fetch(`/api/media?${new URLSearchParams({ search: query, type: type === "all" ? filter : type, page: String(page) })}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Cannot load Media Library.");
      if (request === listRequest.current) { setMedia(data.media); setTotal(data.total); if (page > 1 && !data.media.length) setPage(page - 1); }
    } catch (failure) { if (!controller.signal.aborted) throw failure; }
  }, [query, type, filter, page]);
  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; }, [load]);
  useEffect(() => { const timer = setTimeout(() => { if (query !== search) { setLoading(true); setQuery(search); setPage(1); } }, 200); return () => clearTimeout(timer); }, [search, query]);
  useEffect(() => {
    let active = true;
    // Only network completion callbacks update state; starting a request does not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    let active = true;
    void sync().then(() => { if (active) return latestLoad.current(); }).catch((failure) => { if (active) setError(`Website discovery failed. You can keep using files already loaded. ${failure.message}`); }).finally(() => { if (active) setSyncing(false); });
    return () => { active = false; listController.current?.abort(); };
  }, []);
  const selectedId = selected?.assetId;
  useEffect(() => {
    const deleted = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setMedia(items => items.filter(item => item.assetId !== id));
      setSelected(item => item?.assetId === id ? null : item);
      if (!operation.current) void latestLoad.current().catch(failure => setError(failure.message));
    };
    window.addEventListener("ganesh-media-deleted", deleted);
    return () => window.removeEventListener("ganesh-media-deleted", deleted);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/media/${selectedId}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check media usage.");
      setSelected((item) => item?.assetId === selectedId ? data.media : item);
    }).catch((failure) => { if (!controller.signal.aborted) setUsageError(failure.message); }).finally(() => { if (!controller.signal.aborted) setUsageLoading(false); });
    return () => controller.abort();
  }, [selectedId]);
  // Include unsaved selections in this Content Fields session as well as saved references.
  const usages = selected ? [...selected.usages, ...findMediaReferences(currentContent, { id: selected.assetId, urls: [selected.src] }, [typeof window === "undefined" ? "" : window.location.origin, publicOrigin]).map((path) => ({ location: "Current content (including unsaved changes)", path, kind: "changes" as const, ...mediaPlacement(path, currentContent) }))] : [];
  const grouped = groupMediaUsages(usages);
  const restriction = deletionRestriction(usages, selected?.mimeType.startsWith("video/") ? "video" : "image");
  const visible = media;
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
      const removedId = selected.assetId;
      setMedia(items => items.filter(item => item.assetId !== removedId)); setTotal(count => Math.max(0, count - 1));
      setSelected(null); setConfirmDelete(false); setStatus(result.missingFileRemoved ? "The file was already missing. Its library entry has been removed." : result.cleanupPending ? "Media removed from the library. File removal is still finishing; contact your administrator if you need help." : result.externalSourceRetained ? "Media removed from the library. The original file is still available on the website where it is hosted." : "Media permanently deleted.");
      window.dispatchEvent(new CustomEvent("ganesh-media-deleted", { detail: removedId }));
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Deletion failed."); setConfirmDelete(false); }
    finally { operation.current = false; setBusy(false); }
  }
  async function selectMedia() {
    if (!selected || !onSelect || operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/media/${selected.assetId}?check=1`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This selection is no longer available. Choose another file.");
      onSelect(mediaSelection(data.media, alt));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not select media."); }
    finally { operation.current = false; setBusy(false); }
  }
  const preview = (item: LibraryMedia, large = false) => <MediaPreview key={item.assetId} item={item} large={large} />;
  return <section className="ml-library" aria-label="Media Library" aria-busy={loading || busy}>
    <div className="ml-heading"><div><h2>Media Library</h2><span>Your images and videos, in one place.</span></div><label className="ml-upload"><Icon name="upload" />{busy ? "Uploading…" : "Upload media"}<input aria-label="Upload media files" type="file" multiple disabled={busy || loading} accept={type === "video" ? "video/mp4" : type === "image" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp,image/svg+xml,video/mp4"} onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} /></label></div>
    <details className="ml-upload-help"><summary>Accepted files</summary><p className="ml-hint">PNG, JPG, WebP or static SVG · Up to 5 MB each<br />MP4 video · Up to 32 MB each · 50 files per upload</p></details>
    <div className="ml-toolbar"><label>Search media<input type="search" value={search} placeholder="Filename or description" onChange={(event) => { setSearch(event.target.value); }} /></label><div className="ml-filters" role="group" aria-label="Media type">{([['all', 'All Media'], ['image', 'Images'], ['video', 'Videos']] as const).filter(([key]) => type === "all" || key === type).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { if (key !== filter) setLoading(true); setFilter(key); setPage(1); }}>{label}</button>)}</div><button type="button" disabled={busy || syncing} onClick={async () => { setSyncing(true); setError(""); try { await load(); await sync(); await latestLoad.current(); setStatus("Media Library refreshed."); } catch (failure) { setError(String(failure)); } finally { setSyncing(false); } }}>Refresh library</button></div>
    {busy ? <progress max={100} value={progress} aria-label="Media upload progress" /> : null}{status ? <p role="status">{status}</p> : null}{error ? <p className="ml-error" role="alert">{adminMessage(error)}</p> : null}
    {syncing ? <p className="ml-hint" role="status">Checking for new files…</p> : null}{loading ? <p role="status">Loading media…</p> : null}<><p className="ml-hint">{total} files · Page {page} of {Math.max(1, Math.ceil(total / 36))}</p><div className="ml-grid">{visible.map((item) => <button type="button" className="ml-card" key={item.assetId} onClick={() => { setError(""); setUsageError(""); setUsageLoading(true); setSelected(item); setAlt(item.alt || item.filename.replace(/\.[^.]+$/, "")); setConfirmDelete(false); }}><div className="ml-thumb">{preview(item)}{item.mimeType.startsWith("video/") ? <span>Video ▶</span> : null}</div><strong title={item.filename}>{item.filename}</strong><small>{bytesLabel(item.size)}</small></button>)}</div>{!visible.length && !loading ? <p>No files found. Try another search or upload a file.</p> : null}<nav className="ml-action-row" aria-label="Media pages"><button type="button" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous page</button><button type="button" disabled={loading || page * 36 >= total} onClick={() => { setLoading(true); setPage(page + 1); }}>Next page</button></nav></>
    {selected ? <Dialog compact title={onSelect ? "Select media" : "Media details"} onClose={() => { if (!busy) setSelected(null); }} footer={<>
      <button className="ml-danger" type="button" aria-describedby="ml-delete-reason" disabled={busy || usageLoading || !!usageError || usages.length > 0 || confirmDelete} onClick={() => setConfirmDelete(true)}>Delete media</button>
      <div className="ml-action-row"><button type="button" disabled={busy} onClick={() => setSelected(null)}>Close</button>{onSelect ? <button className="ml-primary" type="button" disabled={!alt.trim() || busy} onClick={() => void selectMedia()}>Use selected media</button> : null}</div>
    </>}>
      <div className="ml-details-overview"><div className="ml-preview">{preview(selected, true)}</div><div className="ml-file-summary"><h3>{selected.filename}</h3><p className="ml-hint">{fileTypeLabel(selected.mimeType)} · {bytesLabel(selected.size)}</p><details className="ml-file-more"><summary>File info</summary><dl className="ml-file-info"><div><dt>Upload date</dt><dd>{uploadDateLabel(selected.uploadedAt)}</dd></div>{selected.width && selected.height ? <div><dt>Dimensions</dt><dd>{selected.width} × {selected.height} pixels</dd></div> : null}</dl></details></div></div>
      {onSelect ? <div className="ml-details-actions"><label className="ml-description">{selected.mimeType.startsWith("image/") ? "Image description" : "Video description"}<input value={alt} maxLength={300} aria-describedby="ml-description-help" onChange={(event) => setAlt(event.target.value)} /></label><p className="ml-hint" id="ml-description-help">A short description for people who cannot see it.</p></div> : null}
      <section className="ml-usage-summary" aria-busy={usageLoading}>
        <span className={`ml-usage-badge${!usageLoading && !usageError && !usages.length ? " ml-unused" : ""}`}><Icon name={usageLoading ? "clock" : restriction || usageError ? "lock" : "check"} />{usageLoading ? "Checking usage…" : usageError ? "Usage unavailable" : grouped.website.length ? "On your website" : grouped.changes.length ? "In unpublished changes" : usages.length ? "Saved for recovery" : "Not in use"}</span>
        <p id="ml-delete-reason" className="ml-hint">{usageLoading ? "Please wait before deleting." : usageError ? "Reopen this file to check usage." : restriction || "You can safely delete this file."}</p>
      </section>
      {!usageLoading && (grouped.website.length || grouped.changes.length) ? <details className="ml-history"><summary>Where it’s used</summary>{grouped.website.length ? <><h4>Live website</h4><UsageList groups={grouped.website} /></> : null}{grouped.changes.length ? <><h4>Unpublished changes</h4><UsageList groups={grouped.changes} /></> : null}</details> : null}
      {!usageLoading && (grouped.history.length || grouped.backup.length || grouped.other.length) ? <details className="ml-history"><summary>Saved copies</summary><p className="ml-hint">Kept to restore earlier content. Ask your administrator about removal.</p>{grouped.history.length ? <><h4>History</h4><UsageList groups={grouped.history} /></> : null}{grouped.backup.length ? <><h4>Backup</h4><UsageList groups={grouped.backup} /></> : null}{grouped.other.length ? <><h4>Other saved content</h4><UsageList groups={grouped.other} /></> : null}</details> : null}
      {confirmDelete ? <div className="ml-delete-confirm" role="group" aria-label="Confirm permanent deletion"><p>Delete <strong>{selected.filename}</strong>? This cannot be undone.</p><div className="ml-action-row"><button type="button" autoFocus disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className="ml-danger" type="button" disabled={busy || usageLoading || !!usageError || usages.length > 0} onClick={() => void remove()}>Delete permanently</button></div></div> : null}
      {usageError ? <p className="ml-error" role="alert">{adminMessage(usageError)}</p> : null}{error ? <p className="ml-error" role="alert">{adminMessage(error)}</p> : null}
    </Dialog> : null}
  </section>;
}
export function MediaPicker({ type, onSelect }: { type: "image" | "video"; onSelect: (media: ReturnType<typeof mediaSelection>) => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Choose from Media Library</button>{open ? <Dialog title={type === "image" ? "Choose an image" : "Choose a video"} onClose={() => setOpen(false)}><MediaLibrary type={type} onSelect={(media) => { onSelect(media); setOpen(false); }} /></Dialog> : null}</>;
}
