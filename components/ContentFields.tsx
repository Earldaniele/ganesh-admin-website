"use client";
import { adminMessage } from "@/lib/admin-presentation";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AdminShell } from "./AdminShell";
import { initialContent } from "@/lib/content/seed";
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/content/schema";
import { validateOrderBuilderConfig } from "@/lib/content/validation";
import "./content-fields.css";
import { legacyFieldNotice } from "@/lib/content/field-policy";
import { MediaLibrary, MediaContentContext } from "./MediaLibrary";
import { MediaField, VideoField } from "./EditorFields";
import { reconcileCopyAliases } from "@/lib/content/copy-aliases";
import { useToast } from "./Toast";
import { fieldLabel } from "@/lib/editor-fields";
import { contentIssueSummary } from "@/lib/content/presentation";
import { Icon } from "./Icon";

type ObjectValue = Record<string, unknown>;
const isObject = (value: unknown): value is ObjectValue => typeof value === "object" && value !== null && !Array.isArray(value);
const labelFor = fieldLabel;
const titleFor = (value: unknown, index: number) => isObject(value) ? String(value.name || value.title || value.label || value.question || `Item ${index + 1}`) : `Item ${index + 1}`;
function Confirmation({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={ref} className="cms-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}><h2 id={id}>{title}</h2>{children}</dialog>;
}
function ordered(values: unknown[]) { return values.map((value, order) => isObject(value) && "order" in value ? { ...value, order } : value); }
function createItem(template: unknown): unknown {
  if (!isObject(template)) return "";
  const item = structuredClone(template);
  if ("id" in item) item.id = crypto.randomUUID();
  if ("slug" in item) item.slug = item.id;
  for (const key of ["name", "title", "label", "question"]) if (key in item) item[key] = "New item";
  if ("active" in item) item.active = false;
  if (Array.isArray(item.tiles)) item.tiles = item.tiles.map(createItem);
  return item;
}

type RemoveRequest = { title: string; collection: string; remove: () => void };

function subscribeSection(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
function currentSection() {
  const hash = window.location.hash.slice(1);
  return ["order-builder", "website-content"].includes(hash) ? hash : "media-library";
}

function Field({ name, path = name, value, template, onChange, products, publicOrigin, onUploadState, collection, onRequestRemove }: { name: string; path?: string; value: unknown; template?: unknown; onChange: (value: unknown) => void; products: ContentSnapshot["products"]; publicOrigin: string; onUploadState: (delta: number) => void; collection?: string; onRequestRemove: (request: { title: string; collection: string; item: unknown; remove: () => void }) => void }) {
  const id = useId();
  const legacyNotice = legacyFieldNotice(path);
  if (legacyNotice) return null;
  if (["id", "categoryId", "slug", "schemaVersion", "editorIntegrationVersion", "kind", "order", "assetId"].includes(name)) return null;
  if (name === "relatedProductIds" && Array.isArray(value)) return <fieldset><legend>Related products</legend>{products.map((product) => <label className="cms-check" key={product.id}><input type="checkbox" checked={value.includes(product.id)} onChange={(event) => onChange(event.target.checked ? [...value, product.id] : value.filter((item) => item !== product.id))} />{product.name}</label>)}</fieldset>;
  if (Array.isArray(value)) return <fieldset><legend>{labelFor(name)} ({value.length})</legend>{value.map((item, index) => <details className="cms-item" key={isObject(item) && typeof item.id === "string" ? item.id : index}><summary>{titleFor(item, index)}{isObject(item) && item.active === false ? " · Inactive" : ""}</summary><div className="cms-item-actions"><button type="button" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(ordered(next)); }}>Move up</button><button type="button" disabled={index === value.length - 1} onClick={() => { const next = [...value]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; onChange(ordered(next)); }}>Move down</button><button type="button" onClick={() => onRequestRemove({ title: titleFor(item, index), collection: collection ?? name, item, remove: () => onChange(ordered(value.filter((_, i) => i !== index))) })}>Remove {collection === "products" ? "product" : collection === "fabrics" ? "fabric" : collection === "workCategories" ? "item" : labelFor(name).toLowerCase().replace(/s$/, "")}</button></div><Field path={`${path}.${index}`} name="Details" value={item} template={Array.isArray(template) ? template[0] : undefined} onChange={(next) => onChange(value.map((entry, i) => i === index ? next : entry))} products={products} publicOrigin={publicOrigin} onUploadState={onUploadState} collection={collection} onRequestRemove={onRequestRemove} /></details>)}<button type="button" onClick={() => onChange(ordered([...value, createItem(value[0] ?? (Array.isArray(template) ? template[0] : ""))]))}>Add {labelFor(name)}</button></fieldset>;
  if (isObject(value)) {
    const mediaProps = { value, onChange, publicOrigin, onBusy: (busy: boolean) => onUploadState(busy ? 1 : -1) };
    if (value.kind === "video") return <fieldset><legend>{labelFor(name)}</legend><VideoField {...mediaProps} /></fieldset>;
    if (typeof value.src === "string" && "alt" in value) return <fieldset><legend>{labelFor(name)}</legend><MediaField {...mediaProps} /></fieldset>;
    return <fieldset><legend>{labelFor(name)}</legend>{Object.entries(value).map(([key, child]) => <Field key={key} path={`${path}.${key}`} name={key} value={child} template={isObject(template) ? template[key] : undefined} onChange={(next) => onChange({ ...value, [key]: next })} products={products} publicOrigin={publicOrigin} onUploadState={onUploadState} collection={collection} onRequestRemove={onRequestRemove} />)}</fieldset>;
  }
  if (name === "source") return <div className="cms-field"><label htmlFor={id}>Use a business detail</label><select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value || undefined)}><option value="">Custom text below</option>{["address", "establishedYear", "phone", "email", "hours", "location", "businessName", "tagline", "facebook"].map((key) => <option key={key} value={key}>{labelFor(key)}</option>)}</select><small>Choose a saved business detail, or choose Custom text below to enter your own.</small></div>;
  if (typeof value === "boolean") return <label className="cms-check"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />{labelFor(name)} <small>{value ? "Active on the public site" : "Hidden from visitors"}</small></label>;
  return <div className="cms-field"><label htmlFor={id}>{labelFor(name)}</label>{typeof value === "number" ? <input id={id} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /> : <textarea id={id} rows={String(value || "").length > 160 ? 4 : 2} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}</div>;
}

function OrderBuilderOptions({ content, onChange }: { content: ContentSnapshot; onChange: (next: ContentSnapshot["orderBuilder"]) => void }) {
  const [error, setError] = useState("");
  const config = content.orderBuilder;
  const products = content.products.filter((item) => item.active !== false).map((item) => item.orderBuilderProduct || item.name);
  const fabrics = [config.recommendedFabricLabel || "Standard / Recommended", ...content.fabrics.filter((item) => item.active !== false).map((item) => item.name)];
  function updateList(key: "customizationOptions" | "sizingOptions", next: string[]) {
    const trimmed = next.map((item) => item.trim());
    if (trimmed.some((item) => !item)) { setError("Options cannot be blank."); return; }
    if (new Set(trimmed.map((item) => item.toLowerCase())).size !== trimmed.length) { setError("Options must be unique."); return; }
    if (trimmed.some((item) => item.length > 160)) { setError("Options must be 160 characters or fewer."); return; }
    setError(""); onChange({ ...config, [key]: next });
  }
  function remove(key: "customizationOptions" | "sizingOptions", index: number) {
    const value = config[key][index];
    if ((key === "customizationOptions" && value === config.defaultCustomization) || (key === "sizingOptions" && value === config.defaultSizing)) { setError(`Choose a replacement default before removing “${value}”.`); return; }
    updateList(key, config[key].filter((_, position) => position !== index));
  }
  function move(key: "customizationOptions" | "sizingOptions", index: number, direction: -1 | 1) { const next = [...config[key]]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; updateList(key, next); }
  function addOption(key: "customizationOptions" | "sizingOptions") { const base = key === "customizationOptions" ? "New customization option" : "New sizing option"; let candidate = base; let count = 2; while (config[key].includes(candidate)) candidate = `${base} ${count++}`; onChange({ ...config, [key]: [...config[key], candidate] }); }
  const list = (key: "customizationOptions" | "sizingOptions", label: string, addLabel: string) => <section className="cms-options-card"><div className="cms-options-heading"><div><p>Order form</p><h3>{label}</h3></div><button type="button" onClick={() => addOption(key)}>{addLabel}</button></div>{config[key].map((option, index) => <div className="cms-option-row" key={`${key}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><input aria-label={`${label} option ${index + 1}`} value={option} onChange={(event) => { const next = [...config[key]]; next[index] = event.target.value; updateList(key, next); }} /><button type="button" aria-label={`Move ${label.toLowerCase()} ${index + 1} up`} disabled={index === 0} onClick={() => move(key, index, -1)}><Icon className="cms-move-up" name="chevron-down" /></button><button type="button" aria-label={`Move ${label.toLowerCase()} ${index + 1} down`} disabled={index === config[key].length - 1} onClick={() => move(key, index, 1)}><Icon name="chevron-down" /></button><button type="button" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => remove(key, index)}><Icon name="x" /></button></div>)}</section>;
  return <section id="order-builder" className="cms-order-builder"><div className="cms-order-builder-intro"><div><h2>Order options</h2><span>Choose what customers can order.</span></div><a href="/editor">Visual Editor ↗</a></div>{list("customizationOptions", "Customization options", "Add option")}{list("sizingOptions", "Sizing options", "Add option")}<div className="cms-order-defaults"><h3>Default selections</h3><div className="cms-default-grid"><label>Default product<select value={config.defaultProduct} onChange={(event) => onChange({ ...config, defaultProduct: event.target.value })}>{products.map((option) => <option key={option}>{option}</option>)}</select></label><label>Default fabric<select value={config.defaultFabric} onChange={(event) => onChange({ ...config, defaultFabric: event.target.value })}>{fabrics.map((option) => <option key={option}>{option}</option>)}</select></label><label>Default customization<select value={config.defaultCustomization} onChange={(event) => onChange({ ...config, defaultCustomization: event.target.value })}>{config.customizationOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Default sizing<select value={config.defaultSizing} onChange={(event) => onChange({ ...config, defaultSizing: event.target.value })}>{config.sizingOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Default quantity<input inputMode="numeric" value={config.defaultQuantity ?? ""} onChange={(event) => onChange({ ...config, defaultQuantity: event.target.value })} /></label><label>Recommended fabric label<input value={config.recommendedFabricLabel ?? ""} onChange={(event) => onChange({ ...config, recommendedFabricLabel: event.target.value })} /></label></div></div>{error ? <p className="cms-error" role="alert">{adminMessage(error)}</p> : null}</section>;
}

export function ContentFields({ publicOrigin }: { publicOrigin: string }) {
  const notify = useToast();
  const section = useSyncExternalStore(subscribeSection, currentSection, () => "media-library");
  const saving = useRef(false);
  const [uploads, setUploads] = useState(0);
  const [content, setContent] = useState<ContentSnapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((user) => setCanPublish(user.permissions?.publish === true)).catch(() => undefined); }, []);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [refreshPending, setRefreshPending] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [removeRequest, setRemoveRequest] = useState<RemoveRequest | null>(null);
  useEffect(() => { fetch("/api/content", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); const parsed = contentSnapshotSchema.safeParse(data.content); if (!parsed.success) throw new Error("Your saved content could not be opened. Please contact your administrator for help."); setContent(parsed.data); setVersion(data.version); }).catch((failure) => setError(failure.message || "Cannot load the draft.")); }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function updateContent(next: ContentSnapshot) { try { const result = reconcileCopyAliases(content, next); setContent(result.content); setDirty(true); setError(""); if (result.reconciledFields.length) setStatus("Linked copy controls updated together: " + result.reconciledFields.join(", ")); } catch (failure) { setError(String(failure)); } }
  function requestRemove(request: { title: string; collection: string; item: unknown; remove: () => void }) {
    if (!content) return;
    const item = isObject(request.item) ? request.item : null;
    if (request.collection === "products" && typeof item?.id === "string") {
      const references = content.workCategories.filter((category) => category.story.relatedProductIds.includes(item.id as string)).map((category) => category.label);
      if (references.length) { setError(`Cannot remove ${request.title}. It is included in these Our Work stories: ${references.join(", ")}. Uncheck this product in those stories first.`); return; }
    }
    const required = ["products", "fabrics", "productionSteps", "workCategories", "sizeGuides"];
    if (required.includes(request.collection) && item?.active !== false) {
      const values = content[request.collection as "products" | "fabrics" | "productionSteps" | "workCategories" | "sizeGuides"];
      if (values.filter((entry) => entry.active !== false).length <= 1) { setError(`Keep at least one active ${labelFor(request.collection).toLowerCase().replace(/s$/, "")} for the public section, or mark it inactive instead.`); return; }
    }
    setRemoveRequest({ title: request.title, collection: request.collection, remove: request.remove });
  }
  async function save(publish: boolean) {
    if (!content || saving.current || busy || uploads) return;
    saving.current = true;
    setBusy(true); setError(""); setStatus("");
    try {
      const parsed = contentSnapshotSchema.safeParse(content);
      if (!parsed.success) throw new Error(contentIssueSummary(parsed.error.issues, content));
      const orderErrors = validateOrderBuilderConfig(parsed.data.orderBuilder);
      if (orderErrors.length) throw new Error(orderErrors.join(" "));
      const response = await fetch("/api/content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: parsed.data, version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "Someone else saved changes while you were editing. Your edits are still here. Keep this tab open and check with them before reloading." : data.error || "Could not save the draft. Your edits are retained.");
      setContent(data.content ?? parsed.data); setVersion(data.version); setDirty(false); setStatus("Changes saved. Publish when you are ready to update the website.");
      if (publish) {
        const publication = await fetch("/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: data.version }) });
        const result = await publication.json();
        if (!publication.ok) throw new Error(result.error || "Draft saved, but publishing failed.");
        setRefreshPending(!result.revalidated); setStatus(result.revalidated ? "Your website is up to date." : "Changes published. Try refreshing the website again.");
      }
      notify(publish ? "Published successfully." : "Draft saved successfully.");
    } catch (failure) { const message = failure instanceof Error ? failure.message : "Cannot connect. Your edits are still here. Please try again."; setError(message); notify(adminMessage(message), "error"); }
    finally { saving.current = false; setBusy(false); }
  }
  return <MediaContentContext.Provider value={{ content, publicOrigin }}><AdminShell eyebrow="Website" title="Content"><div className="cms-fields"><div className="cms-actions"><span>{dirty ? "Unsaved changes" : "All changes saved"}</span><button disabled={!content || busy || uploads > 0} onClick={() => void save(false)}><Icon name="save" />{busy ? "Saving…" : "Save draft"}</button>{canPublish ? <button className="primary-button" disabled={!content || busy || uploads > 0} onClick={() => setPublishConfirm(true)}><Icon name="upload" />Publish</button> : <span>Publishing access required</span>}</div>{error ? <p className="cms-error" role="alert">{adminMessage(error)}</p> : null}{status ? <p role="status">{status}</p> : null}{refreshPending ? <button type="button" onClick={async () => { try { const response = await fetch("/api/content/revalidate", { method: "POST" }); if (!response.ok) throw new Error("Public refresh still unavailable."); setRefreshPending(false); setStatus("Public refresh completed."); } catch (failure) { setError(failure instanceof Error ? failure.message : "Refresh failed."); } }}>Retry public refresh</button> : null}{!content && !error ? <p role="status">Loading your content…</p> : null}{content ? <><nav className="cms-section-nav" aria-label="Content sections">{([{ id: "media-library", label: "Media", icon: "image" }, { id: "order-builder", label: "Order options", icon: "package" }, { id: "website-content", label: "Page content", icon: "file" }] as const).map((item) => <a key={item.id} href={`#${item.id}`} aria-current={section === item.id ? "location" : undefined}><Icon name={item.icon} />{item.label}</a>)}</nav><section id="media-library" hidden={section !== "media-library"}><MediaLibrary currentContent={content} publicOrigin={publicOrigin} /></section><section hidden={section !== "order-builder"}><OrderBuilderOptions content={content} onChange={(next) => updateContent({ ...content, orderBuilder: next })} /></section><section id="website-content" hidden={section !== "website-content"} aria-label="Page content"><fieldset disabled={busy || uploads > 0}>{Object.entries(content).filter(([key]) => !["schemaVersion", "editorIntegrationVersion", "designMedia", "orderBuilder"].includes(key)).map(([key, value]) => <details className="cms-group" key={key}><summary>{labelFor(key)}</summary><Field name={key} value={value} template={initialContent[key as keyof ContentSnapshot]} products={content.products} publicOrigin={publicOrigin} onUploadState={(delta) => setUploads((current) => Math.max(0, current + delta))} collection={key} onRequestRemove={requestRemove} onChange={(next) => updateContent({ ...content, [key]: next })} /></details>)}</fieldset></section></> : null}</div>{publishConfirm ? <Confirmation title="Publish your changes?" onClose={() => setPublishConfirm(false)}><p>Your saved changes will be visible to everyone on the Ganesh website.</p><div className="cms-dialog-actions"><button type="button" onClick={() => setPublishConfirm(false)}>Cancel</button><button className="primary-button" type="button" onClick={() => { setPublishConfirm(false); void save(true); }}>Publish changes</button></div></Confirmation> : null}{removeRequest ? <Confirmation title={`Remove ${removeRequest.title}?`} onClose={() => setRemoveRequest(null)}><p>This item will be removed when you publish. Its images and saved history will still be kept.</p><div className="cms-dialog-actions"><button type="button" onClick={() => setRemoveRequest(null)}>Cancel</button><button className="primary-button" type="button" onClick={() => { removeRequest.remove(); setRemoveRequest(null); setDirty(true); }}>Remove from draft</button></div></Confirmation> : null}</AdminShell></MediaContentContext.Provider>;
}
