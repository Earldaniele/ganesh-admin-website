"use client";
import { adminMessage } from "@/lib/admin-presentation";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Icon, type IconName } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { TeamSettings } from "./TeamSettings";
import type { ContentSnapshot } from "@/lib/content/schema";

export type SettingsSection = "general" | "branding" | "contact" | "account" | "users";

const tabs: { id: SettingsSection; icon: IconName; label: string }[] = [
  { id: "general", icon: "building", label: "General" },
  { id: "branding", icon: "paint", label: "Branding" },
  { id: "contact", icon: "phone", label: "Contact information" },
  { id: "account", icon: "lock", label: "Account / Password" },
  { id: "users", icon: "lock", label: "Users & Roles" },
];

function RequiredMark() {
  return <span className="required-mark" aria-hidden="true">*</span>;
}

function FormField({ error, helper, label, multiline = false, onChange, placeholder, required = false, type = "text", value }: { error?: string; helper?: string; label: string; multiline?: boolean; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; value: string }) {
  const id = `field-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  const descriptionId = `${id}-description`;
  return <div className={`settings-field${error ? " has-error" : ""}`}><label htmlFor={id}>{label}{required ? <RequiredMark /> : null}</label><div>{multiline ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} required={required} aria-invalid={Boolean(error)} aria-describedby={helper || error ? descriptionId : undefined} /> : <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} aria-invalid={Boolean(error)} aria-describedby={helper || error ? descriptionId : undefined} />}{error ? <small className="field-error" id={descriptionId}>{adminMessage(error)}</small> : helper ? <small id={descriptionId}>{helper}</small> : null}</div></div>;
}

function PasswordField({ helper, label, onChange, value }: { helper?: string; label: string; onChange: (value: string) => void; value: string }) {
  const [visible, setVisible] = useState(false);
  const id = `field-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <div className="settings-field"><label htmlFor={id}>{label}<RequiredMark /></label><div><div className="password-control"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required autoComplete="new-password" /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}><Icon name={visible ? "eye-off" : "eye"} /></button></div>{helper ? <small>{helper}</small> : null}</div></div>;
}

function SaveBar({ label = "Save changes", onSave }: { label?: string; onSave: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return <div className="settings-actions"><span><i /> Settings are private until you publish</span><button className="primary-button" type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }}>{saving ? <span className="spinner" /> : <Icon name="save" />}{saving ? "Saving…" : label}</button></div>;
}

function GeneralSettings({ initial, onSaved }: { initial: ContentSnapshot; onSaved: (data: { business: string; tagline: string; summary: string; year: string; location: string }) => Promise<void> }) {
  const [data, setData] = useState({ business: initial.global.businessName, tagline: initial.global.tagline, summary: initial.pages.home.brandStatement.copy, year: initial.global.establishedYear, location: initial.global.location });
  const [error, setError] = useState("");
  const set = (key: keyof typeof data, value: string) => setData((current) => ({ ...current, [key]: value }));
  async function validate() { if (!data.business.trim() || !data.tagline.trim() || !data.location.trim()) { setError("Business name, tagline, and location are required."); return; } if (!/^\d{4}$/.test(data.year)) { setError("Enter a four-digit established year."); return; } setError(""); await onSaved(data); }
  return <div className="settings-card"><div className="settings-card-heading"><span className="settings-heading-icon"><Icon name="building" /></span><div><h2>General</h2><p>The core details visitors see across your website.</p></div></div><div className="settings-form"><FormField label="Business name" value={data.business} onChange={(value) => set("business", value)} required /><FormField label="Tagline" value={data.tagline} onChange={(value) => set("tagline", value)} required /><FormField label="About summary" value={data.summary} onChange={(value) => set("summary", value)} multiline helper="A short introduction used in your website summary." /><FormField label="Established year" value={data.year} onChange={(value) => set("year", value)} type="number" required /><FormField label="Location" value={data.location} onChange={(value) => set("location", value)} required />{error ? <p className="settings-error" role="alert">{adminMessage(error)}</p> : null}</div><SaveBar onSave={validate} /></div>;
}

function BrandingSettings({ initial, publicOrigin }: { initial: ContentSnapshot; publicOrigin: string }) {
  const imageUrl = (src: string) => src.startsWith("/") && !src.startsWith("/media/content/") ? `${publicOrigin}${src}` : src;
  return <div className="settings-card"><div className="settings-card-heading"><span className="settings-heading-icon"><Icon name="paint" /></span><div><h2>Branding</h2><p>Your website uses the approved Ganesh colors and fonts.</p></div></div><div className="settings-form"><p>Change your logo and main image in the <Link href="/editor">Visual Editor</Link>. Find images, your browser icon, and your sharing image in <Link href="/content">Content fields</Link>.</p><div className="branding-previews"><figure><img src={imageUrl(initial.global.logo.src)} alt={initial.global.logo.alt || "Current Ganesh logo"} /><figcaption>Website logo</figcaption></figure><figure><img src={imageUrl(initial.global.favicon.src)} alt={initial.global.favicon.alt || "Current browser icon"} /><figcaption>Browser icon</figcaption></figure></div><p>Media changes remain private until you publish.</p></div></div>;
}

function ContactSettings({ initial, onSaved }: { initial: ContentSnapshot; onSaved: (data: { phone: string; email: string; facebook: string; address: string; maps: string; hours: string }) => Promise<void> }) {
  const [data, setData] = useState({ phone: initial.global.phone, email: initial.global.email, facebook: initial.global.facebook, address: initial.global.address, maps: initial.global.maps, hours: initial.global.hours });
  const [error, setError] = useState("");
  const set = (key: keyof typeof data, value: string) => setData((current) => ({ ...current, [key]: value }));
  async function validate() { if (!data.address.trim()) { setError("Business address is required."); return; } if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) { setError("Enter a valid email address."); return; } setError(""); await onSaved(data); }
  return <div className="settings-card"><div className="settings-card-heading"><span className="settings-heading-icon"><Icon name="phone" /></span><div><h2>Contact information</h2><p>Keep your contact details up to date. To show phone, email, or hours in the footer, select them under Content fields → Website pages → Home → Footer → Details.</p></div></div><div className="settings-form"><FormField label="Phone number" value={data.phone} onChange={(value) => set("phone", value)} placeholder="Add phone number" /><FormField label="Email address" value={data.email} onChange={(value) => set("email", value)} type="email" placeholder="Add email address" /><FormField label="Facebook page" value={data.facebook} onChange={(value) => set("facebook", value)} type="url" placeholder="Add Facebook page URL" /><FormField label="Business address" value={data.address} onChange={(value) => set("address", value)} multiline required /><FormField label="Google Maps link" value={data.maps} onChange={(value) => set("maps", value)} type="url" /><FormField label="Business hours" value={data.hours} onChange={(value) => set("hours", value)} multiline placeholder="Monday–Saturday, 8:00 AM–5:00 PM" />{error ? <p className="settings-error" role="alert">{adminMessage(error)}</p> : null}</div><SaveBar onSave={validate} /></div>;
}

function AccountSettings({ onSaved }: { onSaved: (data: { name: string; email: string; currentPassword: string; newPassword: string }) => Promise<void> }) {
  const [data, setData] = useState({ name: "Admin User", email: "admin@example.com", role: "Administrator", current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const set = (key: keyof typeof data, value: string) => setData((current) => ({ ...current, [key]: value }));
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((profile) => { if (profile?.displayName) setData((current) => ({ ...current, name: profile.displayName, email: profile.email ?? current.email, role: profile.roleName ?? profile.role })); }).catch(() => undefined); }, []);
  async function validate() { if (!data.name.trim() || !data.email.trim()) { setError("Full name and email address are required."); return; } if (!data.current || data.next.length < 10) { setError("Enter your current password and use at least 10 characters for the new password."); return; } if (!/[A-Za-z]/.test(data.next) || !/\d/.test(data.next)) { setError("Use at least one letter and one number in the new password."); return; } if (data.next !== data.confirm) { setError("The new passwords do not match."); return; } setError(""); await onSaved({ name: data.name, email: data.email, currentPassword: data.current, newPassword: data.next }); }
  return <div className="settings-card"><div className="settings-card-heading"><span className="settings-heading-icon"><Icon name="lock" /></span><div><h2>Account / Password</h2><p>Update your administrator profile and password securely.</p></div></div><div className="settings-form"><FormField label="Full name" value={data.name} onChange={(value) => set("name", value)} required /><FormField label="Email address" value={data.email} onChange={(value) => set("email", value)} type="email" required /><div className="settings-field"><label htmlFor="field-role">Role</label><div><select id="field-role" value={data.role} disabled><option>{data.role}</option></select></div></div><PasswordField label="Current password" value={data.current} onChange={(value) => set("current", value)} helper="Enter your current password to make changes." /><PasswordField label="New password" value={data.next} onChange={(value) => set("next", value)} helper="Minimum 10 characters with letters and numbers." /><PasswordField label="Confirm new password" value={data.confirm} onChange={(value) => set("confirm", value)} helper="Re-enter your new password." />{error ? <p className="settings-error" role="alert">{adminMessage(error)}</p> : null}</div><SaveBar label="Update password" onSave={validate} /></div>;
}

export function SettingsClient({ section, canManageUsers = false, publicOrigin = "" }: { section: SettingsSection; canManageUsers?: boolean; publicOrigin?: string }) {
  const notify = useToast();
  const saving = useRef(false);
  const [draft, setDraft] = useState<ContentSnapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => { if (section === "users" || section === "account") return; fetch("/api/content", { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Cannot load settings."); return payload; }).then((payload) => { setDraft(payload.content); setVersion(Number(payload.version)); }).catch((failure) => setError(failure.message || "Cannot load settings.")); }, [section]);
  async function saved(data?: unknown) {
    if (saving.current) return;
    saving.current = true;
    setError("");
    try {
    if (section === "branding") return;
    if (section === "account") {
      const values = data as { name?: string; email?: string; currentPassword?: string; newPassword?: string };
      const response = await fetch("/api/auth/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update the account.");
      setDirty(false); notify("Changes saved successfully.");
      setAccountNotice("Sign in again with your new password.");
      return;
    }
    if (!draft) throw new Error("Load the current draft before saving settings.");
    const next = structuredClone(draft) as ContentSnapshot;
    if (section === "general" && data && typeof data === "object") { const values = data as { business: string; tagline: string; summary: string; year: string; location: string }; next.global.businessName = values.business; next.global.tagline = values.tagline; next.global.establishedYear = values.year; next.global.location = values.location; next.pages.home.brandStatement.copy = values.summary; }
    if (section === "contact" && data && typeof data === "object") { const values = data as { phone: string; email: string; facebook: string; address: string; maps: string; hours: string }; Object.assign(next.global, values); if (values.maps) next.pages.home.footer.secondary.href = values.maps; }
    const response = await fetch("/api/content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: next, version }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 409 ? "Someone else saved changes while you were editing. Your edits are still here. Keep this tab open and check with them before reloading." : [payload.error, payload.issues?.[0]?.message].filter(Boolean).join(" ") || "Could not save settings. Your changes have been kept.");
    setDirty(false); setDraft(next); setVersion(Number(payload.version) || version + 1); notify("Changes saved successfully.");
    } catch (failure) { const message = failure instanceof Error ? failure.message : "Cannot connect. Your changes are still here. Please try again."; setError(message); notify(adminMessage(message), "error"); }
    finally { saving.current = false; }
  }
  return <AdminShell eyebrow="Website configuration" title="Settings"><div className="settings-page" onChangeCapture={() => { if (section !== "users") setDirty(true); }}><nav className="settings-tabs" aria-label="Settings sections">{tabs.filter((tab) => tab.id !== "users" || canManageUsers).map((tab) => <Link className={tab.id === section ? "active" : ""} href={`/settings/${tab.id}`} key={tab.id} aria-current={tab.id === section ? "page" : undefined}><Icon name={tab.icon} /><span>{tab.label}</span></Link>)}</nav>{error ? <p className="settings-error" role="alert">{adminMessage(error)}</p> : null}{accountNotice ? <p role="status">{accountNotice}</p> : null}{!draft && !error && section !== "account" && section !== "users" ? <p role="status">Loading your settings…</p> : null}{section === "general" ? draft ? <GeneralSettings key={version} initial={draft} onSaved={saved} /> : null : null}{section === "branding" ? draft ? <BrandingSettings initial={draft} publicOrigin={publicOrigin} /> : null : null}{section === "contact" ? draft ? <ContactSettings key={version} initial={draft} onSaved={saved} /> : null : null}{section === "account" ? <AccountSettings onSaved={saved} /> : null}{section === "users" && canManageUsers ? <TeamSettings /> : null}</div></AdminShell>;
}
