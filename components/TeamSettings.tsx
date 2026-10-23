"use client";
import { adminMessage } from "@/lib/admin-presentation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";
import type { Role, TeamUser } from "@/lib/auth/roles";
import "./team-settings.css";

type Team = { users: TeamUser[]; roles: Role[]; currentUserId: string };
const emptyAccount = { name: "", email: "", password: "", role: "editor" };
async function fetchTeam(): Promise<Team> {
  const response = await fetch("/api/settings/users", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Cannot load accounts and roles.");
  return data;
}

export function TeamSettings() {
  const notify = useToast();
  const saving = useRef(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [account, setAccount] = useState(emptyAccount);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [roleForm, setRoleForm] = useState({ name: "", canPublish: false });
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function load() {
    const data = await fetchTeam();
    setTeam(data); setSelectedRoles({});
  }
  useEffect(() => { let active = true; void fetchTeam().then((data) => { if (active) setTeam(data); }).catch((failure) => { if (active) setError(failure.message); }); return () => { active = false; }; }, []);
  const dirty = Boolean(account.name || account.email || account.password || roleForm.name || Object.keys(selectedRoles).length);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(url: string, method: string, body: unknown, success: string, reset: () => void) {
    if (saving.current || busy) return;
    saving.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save changes.");
      reset(); setMessage(success);
      notify("Changes saved successfully.");
      await load();
    } catch (failure) { const message = failure instanceof Error ? failure.message : "Connection failed. Please try again."; setError(message); notify(adminMessage(message), "error"); }
    finally { saving.current = false; setBusy(false); }
  }
  function resetRole() { setEditingRole(null); setRoleForm({ name: "", canPublish: false }); }
  return <div className="team-settings">
    <div className="team-intro"><h2>Users &amp; Roles</h2><p>Give your team their own sign-in. Account and role changes take effect immediately.</p></div>
    {error ? <div className="team-notice team-error" role="alert">{adminMessage(error)}<button type="button" disabled={busy} onClick={() => void load().then(() => setError("")).catch((failure) => setError(failure.message))}>Refresh list</button></div> : null}
    {message ? <p className="team-notice" role="status">{message}</p> : null}
    {!team ? <p role="status">{error ? "Accounts are unavailable." : "Loading accounts and roles…"}</p> : <>
      <section className="settings-card"><div className="settings-card-heading"><div><h3>Create account</h3><p>Choose a role and a password for the new team member. Share their sign-in details with them directly.</p></div></div>
        <form onSubmit={(event) => { event.preventDefault(); void save("/api/settings/users", "POST", account, "Account created. The team member can now sign in with the email and password you set.", () => { setAccount(emptyAccount); setShowPassword(false); }); }}>
          <fieldset className="team-form" disabled={busy}>
            <label>Full name<input autoComplete="off" required maxLength={120} value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /></label>
            <label>Email address<input type="email" autoComplete="off" required maxLength={255} value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} /></label>
            <div><label htmlFor="new-team-password">Password</label><div className="team-password"><input id="new-team-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={256} aria-describedby="team-password-help" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div><small id="team-password-help">At least 10 characters. They can change it in Account / Password.</small></div>
            <label>Role<select value={account.role} onChange={(e) => setAccount({ ...account, role: e.target.value })}>{team.roles.map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
            <div className="team-form-action"><button className="primary-button" type="submit">{busy ? "Saving…" : "Create account"}</button></div>
          </fieldset>
        </form>
      </section>
      <section className="settings-card"><div className="settings-card-heading"><div><h3>Team accounts</h3><p>Change a role, then save. That person will need to sign in again.</p></div></div>
        <div className="team-users">{team.users.length ? team.users.map((user) => {
          const isSelf = user.id === team.currentUserId;
          const value = selectedRoles[user.id] ?? user.role;
          return <form className="team-user" key={user.id} onSubmit={(event) => { event.preventDefault(); void save("/api/settings/users", "PATCH", { id: user.id, role: value, expectedRole: user.role }, `Role updated for ${user.name}. They will need to sign in again.`, () => setSelectedRoles((current) => { const next = { ...current }; delete next[user.id]; return next; })); }}>
            <div><strong>{user.name}{isSelf ? " (you)" : ""}</strong><span>{user.email}</span>{isSelf ? <small>Another administrator can change your role.</small> : null}</div>
            <label>Role for {user.name}<select disabled={busy || isSelf} value={value} onChange={(event) => setSelectedRoles((current) => { const next = { ...current }; if (event.target.value === user.role) delete next[user.id]; else next[user.id] = event.target.value; return next; })}>{team.roles.map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
            <button className="primary-button" type="submit" disabled={busy || isSelf || value === user.role}>Save role<span className="sr-only"> for {user.name}</span></button>
          </form>;
        }) : <p>No accounts found.</p>}</div>
      </section>
      <section className="settings-card"><div className="settings-card-heading"><div><h3>Roles &amp; permissions</h3><p>Every role can edit content, upload images and save private drafts. Only Administrators manage accounts and roles.</p></div></div>
        <div className="team-roles">{team.roles.map((role) => <div className="team-role" key={role.id}><div><strong>{role.name}</strong><p>{role.id === "administrator" ? "Full access, including accounts, roles and publishing." : role.canPublish ? "Edit, save drafts and publish the website." : "Edit and save drafts. Publishing needs an authorized team member."}</p></div>{role.isSystem ? <span className="team-badge">Built-in</span> : <button type="button" disabled={busy} onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, canPublish: role.canPublish }); }}>Edit<span className="sr-only"> {role.name} role</span></button>}</div>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void save("/api/settings/roles", editingRole ? "PATCH" : "POST", { ...roleForm, ...(editingRole ? { id: editingRole.id, version: editingRole.version } : {}) }, editingRole ? "Role updated. Its permissions apply to everyone assigned to it." : "Role created. You can now assign it to team accounts.", resetRole); }}>
          <fieldset className="team-form team-role-form" disabled={busy}><legend>{editingRole ? `Edit role: ${editingRole.name}` : "Add a custom role"}</legend>
            <label>Role name<input required minLength={2} maxLength={80} placeholder="For example: Content Publisher" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} /></label>
            <label className="team-permission"><input type="checkbox" checked={roleForm.canPublish} onChange={(e) => setRoleForm({ ...roleForm, canPublish: e.target.checked })} /><span>Can publish the website<small>Allow this role to make saved content visible to visitors.</small></span></label>
            <div className="team-form-action">{editingRole ? <button type="button" onClick={resetRole}>Cancel</button> : null}<button className="primary-button" type="submit">{editingRole ? "Save role changes" : "Add role"}</button></div>
          </fieldset>
        </form>
      </section>
    </>}
  </div>;
}
