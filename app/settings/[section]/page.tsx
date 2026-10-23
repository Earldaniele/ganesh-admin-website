import { getAdminUser } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { SettingsClient, type SettingsSection } from "@/components/SettingsClient";

const validSections: SettingsSection[] = ["general", "branding", "contact", "account", "users"];

export default async function SettingsPage({ params }: PageProps<"/settings/[section]">) {
  const { section } = await params;
  if (!validSections.includes(section as SettingsSection)) notFound();
  const user = await getAdminUser();
  if (!user) redirect("/login");
  if (section === "users" && !user.permissions.manageUsers) redirect("/settings/account");
  return <SettingsClient section={section as SettingsSection} canManageUsers={user.permissions.manageUsers} publicOrigin={process.env.PUBLIC_SITE_ORIGIN || "http://localhost:3000"} />;
}
