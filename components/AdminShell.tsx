"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";

const primaryNav: { href: string; icon: IconName; label: string }[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/editor", icon: "edit", label: "Visual Editor" },
  { href: "/content", icon: "file", label: "Content fields" },
  { href: "/settings/general", icon: "settings", label: "Settings" },
];

export function AdminShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ displayName: string; role: string; roleName: string; permissions: { manageUsers: boolean } } | null>(null);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => { if (response.ok) setProfile(await response.json()); }).catch(() => undefined); }, []);

  return (
    <div className="admin-shell">
      <button className="mobile-menu" onClick={() => setOpen(true)} type="button" aria-label="Open navigation">
        <Icon name="menu" />
      </button>
      {open ? <button className="shell-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandLogo inverse />
          <button className="sidebar-close" onClick={() => setOpen(false)} type="button" aria-label="Close navigation"><Icon name="x" /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          <p className="sidebar-label">Workspace</p>
          {primaryNav.map((item) => {
            const active = pathname === item.href || (item.href.startsWith("/settings") && pathname.startsWith("/settings"));
            return (
              <div className="nav-group" key={item.href}>
                <Link className={active ? "active" : ""} href={item.href} onClick={() => setOpen(false)}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.label === "Settings" ? <Icon className="nav-chevron" name="chevron-down" /> : null}
                </Link>
                {item.label === "Content fields" && active ? <div className="sidebar-subnav"><Link href="/content#order-builder">Order Builder options</Link></div> : null}
                {item.label === "Settings" && pathname.startsWith("/settings") ? (
                  <div className="sidebar-subnav">
                    <Link className={pathname.endsWith("/general") ? "active" : ""} href="/settings/general">General</Link>
                    <Link className={pathname.endsWith("/branding") ? "active" : ""} href="/settings/branding">Branding</Link>
                    <Link className={pathname.endsWith("/contact") ? "active" : ""} href="/settings/contact">Contact information</Link>
                    {profile?.permissions.manageUsers ? <Link className={pathname.endsWith("/users") ? "active" : ""} href="/settings/users">Users &amp; Roles</Link> : null}
                    <Link className={pathname.endsWith("/account") ? "active" : ""} href="/settings/account">Account / Password</Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-flourish" aria-hidden="true">
          <span className="flourish-stem" />
          <span className="flourish-leaf leaf-one" />
          <span className="flourish-leaf leaf-two" />
          <span className="flourish-leaf leaf-three" />
        </div>
        <div className="sidebar-user">
          <span className="avatar">AU</span>
          <span><strong>{profile?.displayName || "Signed-in user"}</strong><small>{profile?.roleName || "Authorized account"}</small></span>
          <button type="button" aria-label="Log out" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}><Icon name="logout" /></button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="page-header">
          <div>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="page-header-actions">
            <span className="prototype-pill"><span /> Content CMS</span>
            <button className="icon-button" type="button" disabled title="Notifications are not implemented" aria-label="Notifications unavailable"><Icon name="activity" /></button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
