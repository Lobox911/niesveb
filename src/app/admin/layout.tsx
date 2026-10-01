import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "./actions";
import AdminNav from "./AdminNav";
import AdminShell from "./AdminShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Admin has its own chrome. It deliberately does NOT render the public
 * Header/Footer — officers have no use for "Join online" or "Photo card",
 * and inheriting them made the admin look like a logged-in public page
 * rather than a tool.
 *
 * AdminShell decides how that chrome is presented: a sidebar on a laptop, a
 * bar and a sheet on a phone.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell
      nav={<AdminNav role={session.role} />}
      footer={
        <>
          <p className="text-[14px] text-ink">{session.name}</p>
          <p className="mono text-[12px] uppercase tracking-wider text-muted">{session.role}</p>
          <form action={logoutAction}>
            <button type="submit" className="btn-secondary mt-3 w-full">Sign out</button>
          </form>
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="mt-3 block text-center text-[13px] text-muted hover:text-ink hover:underline"
          >
            View public site
          </a>
        </>
      }
    >
      {children}
    </AdminShell>
  );
}