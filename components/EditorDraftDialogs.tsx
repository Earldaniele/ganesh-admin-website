"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { EditorDialog } from "./EditorFields";
import type { EditorChange, SavedEditorDraft, SavedEditorDraftSummary } from "@/lib/editor-changes";
import { fieldLabel } from "@/lib/editor-fields";

function readable(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((entry, i) => `${i + 1}. ${readable(entry)}`).join("\n");
  if (value && typeof value === "object") return Object.entries(value).filter(([key]) => !["id", "assetId", "kind", "order", "categoryId", "schemaVersion"].includes(key)).map(([key, entry]) => `${fieldLabel(key)}: ${readable(entry)}`).join("\n");
  return value === "" ? "(empty)" : String(value ?? "Not present");
}

function Value({ value, image, origin }: { value: unknown; image: boolean; origin: string }) {
  if (value === undefined) return <em>Not present</em>;
  const sources: string[] = [];
  function collect(v: unknown) {
    if (!v || typeof v !== "object") return;
    if ("src" in v && typeof v.src === "string" && !("kind" in v && v.kind === "video") && !/\.mp4(?:\?|$)/i.test(v.src)) sources.push(v.src);
    Object.values(v).forEach(collect);
  }
  collect(value);
  if (image && typeof value === "string" && value) sources.push(value);
  function display(src: string) { return src.startsWith("/") && !src.startsWith("/media/content/") ? `${origin}${src}` : src; }
  return <>{sources.map((src, i) => <img key={`${src}-${i}`} src={display(src)} alt="Content change preview" loading="lazy" />)}<pre>{readable(value)}</pre></>;
}
export function ChangeList({ changes, onUndo, origin, disabled }: { changes: EditorChange[]; onUndo?: (change: EditorChange) => void; origin: string; disabled?: boolean }) {
  const groups = new Map<string, EditorChange[]>();
  for (const change of changes) { const key = `${change.page} / ${change.section}`; groups.set(key, [...(groups.get(key) ?? []), change]); }
  if (!changes.length) return <p>No pending changes.</p>;
  return <div className="ve-change-list">{[...groups].map(([group, entries]) => <section key={group}><h3>{group}</h3>{entries.map(change => <article className="ve-change" key={JSON.stringify(change.locator)}><header><div><h4>{change.field}</h4></div><span className="ve-change-kind">{change.kind === "added" ? "Addition" : change.kind === "deleted" ? "Deletion" : "Updated"}</span>{onUndo ? <button disabled={disabled} aria-label={`Undo ${change.field}`} onClick={() => onUndo(change)}>Undo</button> : null}</header><div className="ve-before-after"><div><strong>Before</strong><Value value={change.before} image={change.path.endsWith(".src") && !change.path.includes(".video.")} origin={origin} /></div><div><strong>After</strong><Value value={change.after} image={change.path.endsWith(".src") && !change.path.includes(".video.")} origin={origin} /></div></div></article>)}</section>)}</div>;
}

type Props = {
  initialView: "changes" | "drafts" | "save"; changes: EditorChange[]; drafts: SavedEditorDraftSummary[];
  dirty: boolean; busy: boolean; error: string; origin: string; onClose: () => void;
  onUndo: (change: EditorChange) => void; onDiscard: () => void;
  onSave: (name: string) => Promise<boolean>; onLoad: (draft: SavedEditorDraft) => void;
  onRefresh: () => Promise<void>;
};
export default function EditorDraftDialogs(props: Props) {
  const [view, setView] = useState<"changes" | "drafts" | "save" | "detail" | "load" | "discard">(props.initialView);
  const [draft, setDraft] = useState<SavedEditorDraft | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveThenLoad, setSaveThenLoad] = useState(false);
  const blocked = props.busy || loading;
  function go(next: typeof view) { setError(""); setView(next); }
  async function inspect(id: string) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/editor-drafts?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not open draft.");
      setDraft(result.draft); go("detail");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connection failed."); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!name.trim()) { setError("Enter a name for this draft."); return; }
    if (await props.onSave(name.trim())) {
      if (saveThenLoad && draft) props.onLoad(draft);
      props.onClose();
    }
  }
  const title = view === "changes" ? `Changes (${props.changes.length})` : view === "drafts" ? `Drafts (${props.drafts.length})` : view === "detail" ? draft?.name ?? "Draft details" : view === "save" ? "Save a named draft" : view === "load" ? "Keep your unsaved edits?" : "Discard all pending changes?";
  // Remount the native dialog when its view changes so keyboard focus enters the new content.
  return <EditorDialog key={view} title={title} onClose={() => { if (!blocked) props.onClose(); }}>
    <div className="ve-draft-dialog" aria-busy={blocked}>
      {view === "changes" ? <><p>Review your working preview. Changes become live only after successful publishing.</p><ChangeList changes={props.changes} onUndo={props.onUndo} disabled={blocked} origin={props.origin} /><footer><button disabled={blocked || !props.changes.length} onClick={() => go("discard")}>Discard all</button><button disabled={blocked} onClick={props.onClose}>Keep editing</button><button className="primary" disabled={blocked} onClick={() => { setSaveThenLoad(false); go("save"); }}>Save Draft</button></footer></> : null}
      {view === "drafts" ? <><p>Saved snapshots stay private until published. Open a draft to review it without changing your preview.</p><button disabled={blocked} onClick={async () => { setLoading(true); try { await props.onRefresh(); } catch { setError("Could not refresh drafts. Try again."); } finally { setLoading(false); } }}>Refresh drafts</button>{!props.drafts.length ? <p>No saved drafts yet.</p> : <ul className="ve-draft-list">{props.drafts.map(entry => <li key={entry.id}><button disabled={blocked} onClick={() => void inspect(entry.id)}><strong>{entry.name}</strong><time dateTime={entry.savedAt}>{new Date(entry.savedAt).toLocaleString()}</time><span>{entry.changeCount} changes</span><small>{entry.sections.join("; ") || "No affected sections"}</small></button></li>)}</ul>}<footer><button disabled={blocked} onClick={props.onClose}>Close</button></footer></> : null}
      {view === "detail" && draft ? <><p><time dateTime={draft.savedAt}>{new Date(draft.savedAt).toLocaleString()}</time> · {draft.changeCount} changes</p><ChangeList changes={draft.changes} origin={props.origin} /><footer><button disabled={blocked} onClick={() => go("drafts")}>Back to drafts</button><button disabled={blocked} onClick={props.onClose}>Close</button><button className="primary" disabled={blocked} onClick={() => { if (props.dirty) go("load"); else { props.onLoad(draft); props.onClose(); } }}>Load draft</button></footer></> : null}
      {view === "load" ? <><p>Save your current edits as a new draft before loading “{draft?.name}”, or explicitly discard them.</p><footer><button disabled={blocked} onClick={() => go("detail")}>Keep editing current content</button><button disabled={blocked} onClick={() => { if (draft) props.onLoad(draft); props.onClose(); }}>Discard unsaved edits and load</button><button className="primary" disabled={blocked} onClick={() => { setSaveThenLoad(true); go("save"); }}>Save current edits first</button></footer></> : null}
      {view === "save" ? <form onSubmit={event => { event.preventDefault(); void save(); }}><p>A new snapshot will be saved. Existing drafts will be kept.</p><label>Draft name<input autoFocus required maxLength={120} value={name} disabled={blocked} onChange={event => setName(event.target.value)} /></label><footer><button type="button" disabled={blocked} onClick={() => { if (saveThenLoad) go("load"); else props.onClose(); }}>Keep editing</button><button type="submit" className="primary" disabled={blocked || !name.trim()}>{props.busy ? "Saving…" : saveThenLoad ? "Save Draft and load" : "Save Draft"}</button></footer></form> : null}
      {view === "discard" ? <><p>This restores the original content in your working preview. Saved drafts remain available.</p><footer><button disabled={blocked} onClick={() => go("changes")}>Keep editing</button><button className="primary" disabled={blocked} onClick={() => { props.onDiscard(); go("changes"); }}>Discard all</button></footer></> : null}
      {error ? <p role="alert" className="ve-error">{error}</p> : null}
      {props.error ? <p role="alert" className="ve-error">{props.error}</p> : null}
    </div>
  </EditorDialog>;
}
