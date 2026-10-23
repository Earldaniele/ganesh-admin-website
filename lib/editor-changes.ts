import type { ContentSnapshot } from "./content/schema";
import { pageTargets, pages, getAt, setAt, type PageId } from "./visual-editor.ts";
import { fieldLabel } from "./editor-fields.ts";
import { copyAliasGroups, reconcileCopyAliases } from "./content/copy-aliases.ts";

type Segment = string | { id: string; index: number; followingIds?: string[] };
export type EditorChange = {
  path: string; locator: Segment[]; field: string; page: string; section: string;
  kind: "added" | "deleted" | "changed"; before?: unknown; after?: unknown;
  related?: EditorChange[];
};
export type SavedEditorDraftSummary = { id: string; name: string; savedAt: string; changeCount: number; sections: string[] };
export type SavedEditorDraft = SavedEditorDraftSummary & { content: ContentSnapshot; baseContent: ContentSnapshot; changes: EditorChange[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const sameContent = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameContent(v, b[i]));
  if (object(a) && object(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && sameContent(a[k], b[k]));
  return false;
};

export function reconcileEditorCopy<T>(previous: T, submitted: T, baseline: T): T {
  let next = reconcileCopyAliases(previous, submitted).content;
  for (const group of copyAliasGroups) {
    const changed = group.filter(path => getAt(previous, path) !== getAt(submitted, path));
    // Reverting the visible control restores its original compatibility values too,
    // including older snapshots where those values were deliberately different.
    if (changed.length && changed.every(path => getAt(submitted, path) === getAt(baseline, path))) {
      for (const path of group) next = setAt(next, path, getAt(baseline, path));
    }
  }
  return next;
}

/** Incomplete media links are normal while typing. Keep them in the editor but
 * retain the previous image in the iframe until the link is renderable. */
export function workingPreview<T>(content: T, previous?: T): T {
  const validSource = (value: unknown) => {
    if (typeof value !== "string" || !/^(\/(?!\/)|https?:\/\/)/i.test(value) || /[\u0000-\u0020\\]/.test(value)) return false;
    try { new URL(value, "https://preview.invalid"); return true; } catch { return false; }
  };
  function visit(value: unknown, old: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, Array.isArray(old) ? object(entry) && entry.id ? old.find(item => object(item) && item.id === entry.id) : old[index] : undefined));
    if (!object(value)) return value;
    const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry, object(old) ? old[key] : undefined)]));
    if (typeof value.src === "string" && !(value.kind === "video" && value.src === "") && !validSource(value.src)) result.src = object(old) && validSource(old.src) ? old.src : "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    return result;
  }
  return visit(content, previous) as T;
}

function placement(path: string) {
  const explicit = /^pages\.([^.]+)\./.exec(path)?.[1] as PageId | undefined;
  const candidates = (explicit ? [explicit] : Object.keys(pages) as PageId[]).flatMap(page => pageTargets(page).flatMap(section => section.paths.filter(p => path === p || path.startsWith(`${p}.`)).map(p => ({ page, section: section.label, length: p.length }))));
  candidates.sort((a, b) => b.length - a.length);
  const found = candidates[0];
  const shared = /^(global\.|supportCopy\.|designCopy\.(SiteHeader|SiteFooter)\.)/.test(path);
  return { page: shared ? "Shared website" : found ? pages[found.page].label : "Shared website", section: found?.section ?? fieldLabel(path.split(".")[0]) };
}

/** Compare values, never input events. Keyed collections retain identity across deletion/reordering. */
export function contentChanges(before: unknown, after: unknown): EditorChange[] {
  const changes: EditorChange[] = [];
  function add(a: unknown, b: unknown, path: string, locator: Segment[], label: string) {
    changes.push({ path, locator, field: label, ...placement(path), kind: a === undefined ? "added" : b === undefined ? "deleted" : "changed", ...(a === undefined ? {} : { before: a }), ...(b === undefined ? {} : { after: b }) });
  }
  function visit(a: unknown, b: unknown, path: string, locator: Segment[], label: string) {
    if (sameContent(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      const keyed = [...a, ...b].every(v => object(v) && typeof v.id === "string") && new Set(a.map(v => v.id)).size === a.length && new Set(b.map(v => v.id)).size === b.length;
      if (keyed) {
        const oldIds = a.map(v => String(v.id)), newIds = b.map(v => String(v.id));
        for (const id of new Set([...oldIds, ...newIds])) {
          const oldIndex = oldIds.indexOf(id), newIndex = newIds.indexOf(id), index = newIndex < 0 ? oldIndex : newIndex;
          const old = a[oldIndex], next = b[newIndex], item = next ?? old;
          visit(old, next, `${path}.${index}`, [...locator, { id, index: oldIndex < 0 ? newIndex : oldIndex, followingIds: oldIndex < 0 ? [] : oldIds.slice(oldIndex + 1) }], `${label} · ${item.name ?? item.label ?? item.title ?? id}`);
        }
        const oldCommon = oldIds.filter(id => newIds.includes(id)), newCommon = newIds.filter(id => oldIds.includes(id));
        if (!sameContent(oldCommon, newCommon)) add(oldIds, newIds, `${path}.$order`, [...locator, "$order"], `${label} · Item order`);
      } else if (a.length === b.length && [...a, ...b].every(object)) {
        a.forEach((entry, index) => visit(entry, b[index], `${path}.${index}`, [...locator, String(index)], `${label} · Item ${index + 1}`));
      } else {
        // Unkeyed lists are one field: restoring one index after deletion would shift unrelated entries.
        add(a, b, path, locator, label);
      }
    } else if (object(a) && object(b)) {
      const media = typeof a.src === "string" && typeof b.src === "string";
      if (media && (a.src !== b.src || a.assetId !== b.assetId)) {
        const source = (v: Record<string, unknown>) => ({ src: v.src, ...(v.kind === "video" ? { kind: "video" } : {}), ...(v.assetId === undefined ? {} : { assetId: v.assetId }) });
        add(source(a), source(b), `${path}.src`, [...locator, "$source"], `${label} / File`);
      }
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        // Editors derive this metadata from collection position, not a separate field.
        if (key === "order" && typeof a.order === "number" && typeof b.order === "number") continue;
        if (media && ["src", "assetId"].includes(key)) continue;
        visit(a[key], b[key], path ? `${path}.${key}` : key, [...locator, key], label && /\d|·/.test(label) ? `${label} / ${fieldLabel(key)}` : fieldLabel(key));
      }
    } else add(a, b, path, locator, label);
  }
  visit(before, after, "", [], "Content");
  // Linked copy controls are one editable field, even when compatibility values are stored twice.
  for (const group of copyAliasGroups) {
    const linked = changes.filter(c => (group as readonly string[]).includes(c.path));
    if (linked.length < 2) continue;
    const first = linked.find(c => c.path === group[0]) ?? linked[0];
    first.related = linked.filter(c => c !== first);
    for (const other of first.related) changes.splice(changes.indexOf(other), 1);
  }
  return changes;
}

/** Restore just this field while retaining other pending edits, including adjacent records. */
export function undoContentChange<T>(content: T, change: EditorChange): T {
  if (change.related?.length) {
    const { related, ...primary } = change;
    return related.reduce((next, linked) => undoContentChange(next, linked), undoContentChange(content, primary));
  }
  const copy = structuredClone(content);
  let parent: unknown = copy;
  for (const part of change.locator.slice(0, -1)) {
    if (typeof part === "string") parent = (parent as Record<string, unknown>)[part];
    else parent = (parent as Record<string, unknown>[]).find(v => v.id === part.id);
    if (!parent) return copy;
  }
  const last = change.locator.at(-1)!;
  if (typeof last === "object") {
    const list = parent as Record<string, unknown>[];
    const index = list.findIndex(v => v.id === last.id);
    if (change.kind === "added") { if (index >= 0) list.splice(index, 1); }
    else if (index >= 0) list[index] = structuredClone(change.before) as Record<string, unknown>;
    else {
      const following = last.followingIds?.map(id => list.findIndex(v => v.id === id)).find(i => i >= 0);
      list.splice(following ?? list.length, 0, structuredClone(change.before) as Record<string, unknown>);
    }
    list.forEach((item, position) => { if (typeof item.order === "number") item.order = position; });
  } else if (last === "$source") {
    const media = parent as Record<string, unknown>;
    delete media.assetId;
    Object.assign(media, structuredClone(change.before));
  } else if (last === "$order") {
    const list = parent as Record<string, unknown>[];
    const ids = change.before as string[];
    list.sort((a, b) => { const ai = ids.indexOf(String(a.id)), bi = ids.indexOf(String(b.id)); return (ai < 0 ? ids.length : ai) - (bi < 0 ? ids.length : bi); });
    list.forEach((item, position) => { if (typeof item.order === "number") item.order = position; });
  } else if (change.kind === "added") delete (parent as Record<string, unknown>)[last];
  else (parent as Record<string, unknown>)[last] = structuredClone(change.before);
  return copy;
}
