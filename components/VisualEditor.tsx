"use client";
import { adminMessage } from "@/lib/admin-presentation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/content/schema";
import { initialContent } from "@/lib/content/seed";
import { validateOrderBuilderConfig } from "@/lib/content/validation";
import { editorTargets, pageTargets, pages, getAt, setAt, type EditorTarget, type PageId } from "@/lib/visual-editor";
import { EditorDialog, EditorFields } from "./EditorFields";
import FabricCatalogEditor from "./FabricCatalogEditor";
import { fabricCategories, newFabricCategory, newFabricCard } from "@/lib/fabric-catalog";
import { FeaturedProductsEditor } from "./FeaturedProductsEditor";
import { useToast } from "./Toast";
import { contentIssueSummary } from "@/lib/content/presentation";
import { useResponsiveDrawer } from "./useResponsiveDrawer";
import EditorDraftDialogs from "./EditorDraftDialogs";
import { contentChanges, sameContent, undoContentChange, workingPreview, reconcileEditorCopy, type EditorChange, type SavedEditorDraft, type SavedEditorDraftSummary } from "@/lib/editor-changes";
import "./visual-editor.css";

type Session = { token: string; origin: string; expiresAt: number };
type Panel = { target: EditorTarget; values: Record<string, unknown>; fabricCategoryId?: string; fabricCardId?: string };
export default function VisualEditor() {
  const notify = useToast();
  const saving = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const sectionsRef = useRef<HTMLElement>(null);
  const sectionsToggle = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const [content, setContent] = useState<ContentSnapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState<PageId>("home");
  const [device, setDevice] = useState("desktop");
  const [sectionQuery, setSectionQuery] = useState("");
  const [showSections, setShowSections] = useState(false);
  const closeSections = useCallback(() => setShowSections(false), []);
  useResponsiveDrawer({ open: showSections, close: closeSections, drawer: sectionsRef, trigger: sectionsToggle, background: canvasRef });
  const [editable, setEditable] = useState(true);
  const [baseContent, setBaseContent] = useState<ContentSnapshot | null>(null);
  const [savedContent, setSavedContent] = useState<ContentSnapshot | null>(null);
  const [savedName, setSavedName] = useState("");
  const [drafts, setDrafts] = useState<SavedEditorDraftSummary[]>([]);
  const [draftDialog, setDraftDialog] = useState<"changes" | "drafts" | "save" | null>(null);
  const dirty = !!content && !sameContent(content, savedContent);
  const changes = useMemo(() => content && baseContent ? contentChanges(baseContent, content) : [], [baseContent, content]);
  const [past, setPast] = useState<ContentSnapshot[]>([]);
  const [future, setFuture] = useState<ContentSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((user) => setCanPublish(user.permissions?.publish === true)).catch(() => undefined); }, []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [refreshPending, setRefreshPending] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState("hero");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [remove, setRemove] = useState<{ title: string; apply: () => void } | null>(null);
  const mediaCache = useRef(new Map<string, string>());
  const previousPreview = useRef<ContentSnapshot | undefined>(undefined);
  const targets = useMemo(() => content ? editorTargets(page, content) : [], [page, content]);
  const sections = pageTargets(page);
  const sectionGroups = [
    { label: "Shared website", items: sections.filter((s) => ["header", "support", "footer", "seo"].includes(s.id)) },
    { label: `${pages[page].label} sections`, items: sections.filter((s) => !["header", "support", "footer", "seo"].includes(s.id)) },
  ];
  useEffect(() => {
    if (!panel) return;
    const timer = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("textarea,input,button")?.focus());
    return () => cancelAnimationFrame(timer);
  // Focus enters the side panel once when an editable target is selected.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel?.target.id]);
  const post = useCallback((message: Record<string, unknown>) => {
    if (session) frame.current?.contentWindow?.postMessage({ source: "ganesh-admin-editor", token: session.token, ...message }, session.origin);
  }, [session]);
  const startPreview = useCallback(async () => {
    setPreviewError(""); setReady(false);
    try {
      const response = await fetch("/api/editor-preview", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Preview could not start.");
      setSession(result);
    } catch (failure) { setPreviewError(failure instanceof Error ? failure.message : "Preview unavailable."); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/content", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Cannot load the saved draft.");
      const parsed = contentSnapshotSchema.safeParse(result.content);
      if (!parsed.success) throw new Error("Your saved content could not be opened. Please contact your administrator for help.");
      setContent(parsed.data); setBaseContent(parsed.data); setSavedContent(parsed.data); setVersion(result.version);
      void startPreview();
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message ?? "Cannot load the saved draft."); });
    return () => controller.abort();
  }, [startPreview]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => void startPreview(), Math.max(1000, session.expiresAt - Date.now() - 60000));
    return () => clearTimeout(timer);
  }, [session, startPreview]);
  useEffect(() => {
    if (!session || ready) return;
    const timer = setTimeout(() => setPreviewError("The website preview is unavailable. Try reconnecting. Your edits are still here."), 20000);
    return () => clearTimeout(timer);
  }, [session, ready]);
  function openPanel(target: EditorTarget) {
    if (!content || !editable || busy || uploading) return;
    setSelected(target.id); setError("");
    const values = Object.fromEntries(target.paths.filter((path) => getAt(content, path) !== undefined).map((path) => [path, structuredClone(getAt(content, path))]));
    let fabricCategoryId: string | undefined;
    let fabricCardId: string | undefined;
    if (target.paths.includes("fabricCategories")) {
      values.fabricCategories = structuredClone(fabricCategories(content));
      if (target.id === "fabric-category:new") {
        const categories = values.fabricCategories as NonNullable<ContentSnapshot["fabricCategories"]>;
        if (categories.length >= 100) { setError("Maximum of 100 fabric categories reached."); return; }
        const category = newFabricCategory(categories.length, crypto.randomUUID());
        values.fabricCategories = [...categories, category]; fabricCategoryId = category.id;
      } else if (target.id.startsWith("fabric-public:")) fabricCategoryId = target.id.slice("fabric-public:".length);
      else if (target.id.startsWith("fabric-public-new:")) {
        fabricCategoryId = target.id.slice("fabric-public-new:".length);
        if (content.fabrics.length >= 100) { setError("Maximum of 100 fabric cards reached."); return; }
        const card = newFabricCard(fabricCategoryId, content.fabrics.length, crypto.randomUUID());
        values.fabrics = [...content.fabrics, card]; fabricCardId = card.id;
      }
    }
    const nextPanel = { target, values, fabricCategoryId, fabricCardId };
    setPanel(nextPanel);
    // Creation is an immediate preview edit, just like typing in an existing card.
    if (target.id === "fabric-category:new" || target.id.startsWith("fabric-public-new:")) commitPanel(nextPanel);
  }
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!session || event.source !== frame.current?.contentWindow || event.origin !== session.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.source !== "ganesh-public-preview" || data.token !== session.token) return;
      if (data.type === "ready") { setReady(true); setPreviewError(""); }
      if (data.type === "error" && typeof data.message === "string") setPreviewError(data.message.slice(0, 500));
      if (data.type === "select" && typeof data.id === "string") { const target = targets.find((entry) => entry.id === data.id); if (target) openPanel(target); }
      if (data.type === "navigate" && typeof data.page === "string" && Object.hasOwn(pages, data.page)) { setPage(data.page as PageId); setSelected("hero"); setPanel(null); }
    };
    window.addEventListener("message", receive); return () => window.removeEventListener("message", receive);
  // Selection must use the latest working snapshot, without remounting the iframe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, targets, content, editable, busy, uploading, panel]);
  useEffect(() => {
    if (!ready || !content) return;
    let cancelled = false;
    const preview = workingPreview(content, previousPreview.current);
    previousPreview.current = preview;
    // Private uploaded media is read by the authenticated admin, never by the
    // public image optimizer. Only in-memory data URLs enter the preview frame.
    async function sync() {
      const sources = new Set<string>();
      const mediaLinks = new Map<string, string>();
      function visit(value: unknown) {
        if (!value || typeof value !== "object") return;
        if ("src" in value && typeof value.src === "string") {
          const url = new URL(value.src, location.origin);
          if (url.origin === location.origin && url.pathname.startsWith("/media/content/")) { sources.add(url.href); mediaLinks.set(value.src, url.href); }
        }
        Object.values(value).forEach(visit);
      }
      visit(preview);
      try {
        await Promise.all([...sources].map(async (src) => {
          if (mediaCache.current.has(src)) return;
          const response = await fetch(src, { cache: "no-store" });
          if (!response.ok) throw new Error("A draft image could not load. Sign in again or replace the image.");
          const blob = await response.blob();
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
          mediaCache.current.set(src, data);
        }));
        if (!cancelled) { setPreviewError(""); post({ type: "snapshot", content: preview, page, editable, targets: targets.map(({ id, label, selector }) => ({ id, label, selector })), media: Object.fromEntries([...mediaLinks].map(([original, src]) => [original, mediaCache.current.get(src)])) }); }
      } catch (failure) { if (!cancelled) setPreviewError(failure instanceof Error ? failure.message : "Preview image failed."); }
    }
    void sync(); return () => { cancelled = true; };
  }, [content, ready, page, editable, targets, post]);
  function validate(next: ContentSnapshot) {
    const parsed = contentSnapshotSchema.safeParse(next);
    if (!parsed.success) throw new Error(contentIssueSummary(parsed.error.issues, next));
    const errors = validateOrderBuilderConfig(parsed.data.orderBuilder);
    if (errors.length) throw new Error(errors.join(" "));
    return parsed.data;
  }
  function replaceWorking(next: ContentSnapshot) {
    if (!content || sameContent(content, next)) return;
    setPast(history => [...history.slice(-49), content]); setFuture([]);
    setContent(next); setError(""); setStatus("");
  }
  function commitPanel(nextPanel: Panel) {
    if (!content) return;
    let next = content;
    for (const [path, value] of Object.entries(nextPanel.values)) next = setAt(next, path, value);
    try { const reconciled = reconcileEditorCopy(content, next, baseContent ?? content); replaceWorking(reconciled); return reconciled; }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Check the content."); }
  }
  function updatePanel(values: Record<string, unknown>, categoryId?: string) {
    if (!panel) return;
    const nextPanel = { ...panel, fabricCategoryId: categoryId ?? panel.fabricCategoryId, values: { ...panel.values, ...values } };
    const next = commitPanel(nextPanel);
    setPanel(next ? { ...nextPanel, values: Object.fromEntries(Object.keys(nextPanel.values).map(path => [path, getAt(next, path)])) } : nextPanel);
  }
  function done() {
    setPanel(null); setError(""); post({ type: "restore-focus" });
    if (panel?.fabricCategoryId) post({ type: "fabric-category", id: panel.fabricCategoryId });
  }
  async function refreshDrafts() {
    const response = await fetch("/api/editor-drafts", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load saved drafts.");
    setDrafts(result.drafts);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/editor-drafts", { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load saved drafts.");
      setDrafts(result.drafts);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, []);
  async function saveNamedDraft(name: string) {
    if (!content || !baseContent || saving.current || busy || uploading) return false;
    saving.current = true; setBusy(true); setError("");
    try {
      const snapshot = validate(content);
      const response = await fetch("/api/editor-drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, content: snapshot, baseContent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Draft save failed.");
      const draft = result.draft as SavedEditorDraft;
      setSavedContent(snapshot); setSavedName(draft.name);
      setDrafts(current => [{ id: draft.id, name: draft.name, savedAt: draft.savedAt, changeCount: draft.changeCount, sections: draft.sections }, ...current]);
      setStatus(`Draft saved: ${draft.name}`); notify("Draft saved successfully."); return true;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Connection failed. Your edits are retained.";
      setError(message); notify(adminMessage(message), "error"); return false;
    } finally { saving.current = false; setBusy(false); }
  }
  function loadDraft(draft: SavedEditorDraft) {
    replaceWorking(structuredClone(draft.content));
    setBaseContent(structuredClone(draft.baseContent)); setSavedContent(structuredClone(draft.content));
    setSavedName(draft.name); setPanel(null); setStatus(`Loaded draft: ${draft.name}`);
  }
  function undoField(change: EditorChange) {
    if (!content || busy || uploading) return;
    // Exact restoration also handles compatibility fields with different original values.
    replaceWorking(undoContentChange(content, change)); setPanel(null);
  }
  async function saveAndPublish() {
    if (!content || saving.current || busy || uploading) return;
    saving.current = true; setBusy(true); setError(""); setStatus("");
    try {
      const snapshot = validate(content);
      const response = await fetch("/api/content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: snapshot, version }) });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "Another administrator saved a newer draft. Your changes are still here. Keep this tab open and coordinate with the other administrator before reloading." : result.error ?? "Save failed.");
      const saved = result.content ?? snapshot;
      setContent(saved); setVersion(result.version); setSavedContent(saved); setSavedName("");
      const publicationResponse = await fetch("/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: result.version }) });
      const published = await publicationResponse.json();
      if (!publicationResponse.ok) throw new Error(published.error ?? "Content saved; publication failed. Retry publishing.");
      setBaseContent(saved); setPast([]); setFuture([]); setPanel(null);
      setRefreshPending(!published.revalidated); setStatus(published.revalidated ? "Your website is up to date." : "Changes published. Try refreshing the website again.");
      notify("Published successfully.");
    } catch (failure) { const message = failure instanceof Error ? failure.message : "Connection failed. Your edits are retained."; setError(message); notify(adminMessage(message), "error"); }
    finally { saving.current = false; setBusy(false); }
  }
  function undo() {
    if (!content || !past.length || busy || uploading) return;
    setFuture((history) => [...history, content]); setContent(past[past.length - 1]); setPast((history) => history.slice(0, -1)); setPanel(null); setError(""); setStatus("Previous change restored. Save to keep it.");
  }
  function redo() {
    if (!content || !future.length || busy || uploading) return;
    setPast((history) => [...history, content]); setContent(future[future.length - 1]); setFuture((history) => history.slice(0, -1)); setPanel(null); setError(""); setStatus("Change reapplied.");
  }
  return <div className="ve-editor"><header className="ve-toolbar" inert={showSections}><Link className="ve-brand" href="/dashboard">GANESH <span>ADMIN</span></Link><label>Page<select aria-label="Page" disabled={busy || uploading} value={page} onChange={(event) => { setPage(event.target.value as PageId); setSelected("hero"); setPanel(null); }}>{Object.entries(pages).map(([id, entry]) => <option key={id} value={id}>{entry.label}</option>)}</select></label><div className="ve-mode"><button aria-pressed={editable} onClick={() => setEditable(true)}>Edit</button><button aria-pressed={!editable} onClick={() => { setEditable(false); setPanel(null); }}>Preview</button></div><label>Screen size<select aria-label="Screen size" value={device} onChange={(event) => setDevice(event.target.value)}><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></label><span className="ve-save-state">{dirty ? "● Unsaved changes" : savedName ? `✓ Draft saved: ${savedName}` : "All changes saved"}</span><button disabled={!content || busy || uploading} onClick={() => setDraftDialog("save")}>{busy ? "Saving…" : "Save Draft"}</button><button disabled={!content || busy || uploading} onClick={() => setDraftDialog("changes")}>Changes ({changes.length})</button><button disabled={busy || uploading} onClick={() => { setDraftDialog("drafts"); void refreshDrafts().catch(failure => setError(failure.message)); }}>Drafts ({drafts.length})</button>{canPublish ? <button className="primary" disabled={!content || busy || uploading} onClick={() => setPublishConfirm(true)}>Save &amp; Publish</button> : <span className="ve-save-state">Ask a team member with publishing access to make your changes live</span>}</header>
    <div className="ve-status" aria-live="polite" inert={showSections}><button ref={sectionsToggle} className="ve-sections-toggle" aria-controls="editor-sections" aria-expanded={showSections} onClick={() => setShowSections(!showSections)}>Sections</button><span>{pages[page].label} / {targets.find((t) => t.id === selected)?.label ?? "Page"} · {editable ? "Edit mode" : "Preview mode"}</span><span>{status}</span></div>
    {error ? <div className="ve-error" role="alert">{adminMessage(error)}</div> : null}
    {refreshPending ? <button onClick={async () => { const response = await fetch("/api/content/revalidate", { method: "POST" }).catch(() => null); if (response?.ok) { setRefreshPending(false); setStatus("Public refresh completed."); } else setError("Public refresh still unavailable. Try again."); }}>Retry public refresh</button> : null}
    <div className="ve-workspace">{showSections ? <button className="ve-sections-backdrop" aria-label="Close sections" onClick={closeSections} /> : null}<aside ref={sectionsRef} id="editor-sections" role={showSections ? "dialog" : undefined} aria-modal={showSections ? true : undefined} aria-label="Page sections" className={`ve-sidebar${showSections ? " ve-sidebar-open" : ""}`}><div className="ve-sidebar-heading"><h1>Visual Editor</h1><button className="ve-sections-close" aria-label="Close sections" onClick={closeSections}>×</button></div><p>{editable ? "Choose a section to find it in the preview. Select Edit to open its content controls." : "Customer view. Editing controls are hidden."}</p><label className="ve-section-search">Find a section<input type="search" placeholder="Search sections…" value={sectionQuery} onChange={(event) => setSectionQuery(event.target.value)} /></label><nav aria-label="Page sections">{sectionGroups.map((group) => <section className="ve-section-group" key={group.label}><h2>{group.label}</h2>{group.items.filter((section) => section.label.toLowerCase().includes(sectionQuery.toLowerCase())).map((section) => <div className={`ve-section-row${selected === section.id ? " selected" : ""}`} key={section.id}><button aria-current={selected === section.id ? "true" : undefined} onClick={() => { setSelected(section.id); post({ type: "scroll", selector: section.selector }); setShowSections(false); }}>{section.label}</button>{editable ? <button aria-label={`Edit ${section.label}`} disabled={!content || uploading || busy} onClick={() => { openPanel(section); setShowSections(false); }}>Edit</button> : null}</div>)}</section>)}</nav>{!sections.some((s) => s.label.toLowerCase().includes(sectionQuery.toLowerCase())) ? <p>No matching sections.</p> : null}<div className="ve-history"><button disabled={!past.length || busy || uploading} onClick={undo}>Undo</button><button disabled={!future.length || busy || uploading} onClick={redo}>Redo</button></div></aside>
    <main ref={canvasRef} className="ve-canvas-area"><div className={`ve-canvas ve-device-${device}`}>
      {!content ? <div className="ve-loading" role="status">Loading saved draft…</div> : null}
      {session ? <iframe ref={frame} title="Ganesh website visual preview" src={`${session.origin}/editor-preview?token=${encodeURIComponent(session.token)}`} allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" /> : null}
      {content && (!ready || previewError) ? <div className="ve-loading" role="status"><p>{previewError ? adminMessage(previewError) : "Connecting to your website preview…"}</p>{previewError ? <button onClick={() => void startPreview()}>Reconnect preview</button> : null}</div> : null}
    </div></main>
    {panel ? <aside ref={panelRef} className="ve-panel" aria-label="Edit content panel"><header><div><small>{pages[page].label} / EDIT CONTENT</small><h2>{panel.target.label}</h2></div><button aria-label="Close edit panel and keep changes" disabled={uploading || busy} onClick={done}>×</button></header><p>Edits stay in your working preview as you type. Save Draft to keep a named snapshot, or publish when ready.</p><fieldset disabled={uploading || busy}>{panel.values.fabricCategories && panel.values.fabrics ? <FabricCatalogEditor key={panel.target.id} categories={panel.values.fabricCategories as NonNullable<ContentSnapshot["fabricCategories"]>} fabrics={panel.values.fabrics as ContentSnapshot["fabrics"]} initialCategoryId={panel.fabricCategoryId} initialCardId={panel.fabricCardId} products={content?.products ?? []} publicOrigin={session?.origin ?? "http://localhost:3000"} onBusy={setUploading} requestRemove={(title, _item, apply) => setRemove({ title, apply })} onChange={(categories, fabrics, categoryId) => updatePanel({ fabricCategories: categories, fabrics }, categoryId)} /> : null}{panel.values.featuredProducts ? <FeaturedProductsEditor key={panel.target.id} value={panel.values.featuredProducts as NonNullable<ContentSnapshot["featuredProducts"]>} products={content?.products ?? []} publicOrigin={session?.origin ?? "http://localhost:3000"} onBusy={setUploading} requestRemove={(title, _item, apply) => setRemove({ title, apply })} onChange={(featuredProducts) => updatePanel({ featuredProducts })} /> : null}{Object.entries(panel.values).filter(([path]) => path !== "featuredProducts" && (!panel.values.fabricCategories || !["fabricCategories", "fabrics"].includes(path))).map(([path, value]) => <EditorFields key={path} path={path} name={/^products\.\d+$/.test(path) ? "Product" : path.split(".").at(-1)!} value={value} template={getAt(initialContent, path)} products={content?.products ?? []} publicOrigin={session?.origin ?? "http://localhost:3000"} onBusy={setUploading} onChange={(next) => updatePanel({ [path]: next })} requestRemove={(title, item, apply) => {
      if (item && typeof item === "object" && "id" in item && path.startsWith("products")) {
        const references = content?.workCategories.filter((category) => category.story.relatedProductIds.includes(String(item.id))).map((category) => category.label) ?? [];
        if (references.length) { setError(`Cannot remove ${title}: included in ${references.join(", ")}. Edit those Our Work stories and uncheck the related product first.`); return; }
      }
      setRemove({ title, apply });
    }} />)}</fieldset>{error ? <p className="ve-error" role="alert">{adminMessage(error)}</p> : null}<footer><button className="primary" disabled={uploading || busy} onClick={done}>Done</button></footer></aside> : null}</div>
    {draftDialog ? <EditorDraftDialogs initialView={draftDialog} changes={changes} drafts={drafts} dirty={dirty} busy={busy} error={adminMessage(error)} origin={session?.origin ?? "http://localhost:3000"} onClose={() => setDraftDialog(null)} onUndo={undoField} onDiscard={() => { if (baseContent) replaceWorking(structuredClone(baseContent)); setPanel(null); }} onSave={saveNamedDraft} onLoad={loadDraft} onRefresh={refreshDrafts} /> : null}
    {publishConfirm ? <EditorDialog title="Publish your changes?" onClose={() => setPublishConfirm(false)}><p>Your changes will be visible to everyone on the Ganesh website.</p><footer><button onClick={() => setPublishConfirm(false)}>Cancel</button><button className="primary" onClick={() => { setPublishConfirm(false); void saveAndPublish(); }}>Publish changes</button></footer></EditorDialog> : null}
    {remove ? <EditorDialog title={`Remove ${remove.title}?`} onClose={() => setRemove(null)}><p>This item will be removed when you publish. Its images and saved history will still be kept.</p><footer><button onClick={() => setRemove(null)}>Cancel</button><button className="primary" onClick={() => { remove.apply(); setRemove(null); }}>Remove item</button></footer></EditorDialog> : null}
  </div>;
}
