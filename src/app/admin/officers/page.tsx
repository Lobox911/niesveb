import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, officers } from "@/db";
import { requireOfficer } from "@/lib/auth";
import OfficerList from "./OfficerList";

export const metadata: Metadata = { title: "Users" };

export default async function OfficersPage() {
  const session = await requireOfficer();
  if (session.role !== "admin") redirect("/admin");

  const rows = await db
    .select({
      id: officers.id, name: officers.name, email: officers.email,
      role: officers.role, active: officers.active, createdAt: officers.createdAt,
    })
    .from(officers)
    .orderBy(asc(officers.name));

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Users</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        Branch officers who can sign in. There is no public signup — accounts
        are created here. Officers can verify payments and mark attendance;
        administrators can also change settings, events and users.
      </p>

      <OfficerList
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        currentId={session.id}
      />
    </div>
  );
}