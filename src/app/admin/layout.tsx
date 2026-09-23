import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "./actions";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Admin has its own chrome. It deliberately does NOT render the public
 * Header/Footer — officers have no use for "Join online" or "Photo card",
 * and inheriting them made the admin look like a logged-in public page
 * rather than a tool.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-line bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="border-b border-line p-5">
          <p className="text-[17px] font-semibold text-ink">MCPD Portal</p>
          <p className="text-[13px] text-muted">Ebonyi State Branch</p>
        </div>

        <AdminNav role={session.role} />

        <div className="mt-auto border-t border-line p-5">
          <p className="text-[14px] text-ink">{session.name}</p>
          <p className="mono text-[12px] uppercase tracking-wider text-muted">{session.role}</p>
          <form action={logoutAction}>
            <button type="submit" className="btn-secondary mt-3 w-full">Sign out</button>
          </form>
          <a href="/" className="mt-3 block text-center text-[13px] text-muted hover:text-ink hover:underline">
            View public site
          </a>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}