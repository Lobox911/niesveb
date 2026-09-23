import type { Metadata } from "next";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, registrations, categories, attendance } from "@/db";
import { requireOfficer } from "@/lib/auth";
import RegistrationsTable from "./RegistrationsTable";

export const metadata: Metadata = { title: "Admin dashboard" };

const PAGE_SIZE = 50;

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }>;
}) {
  await requireOfficer();
  const { q, status, category, page } = await searchParams;
  const pageNo = Math.max(1, Number(page) || 1);

  const filters = [];
  if (status === "pending" || status === "confirmed" || status === "rejected") {
    filters.push(eq(registrations.status, status));
  }
  if (category) filters.push(eq(registrations.categoryId, category));
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    filters.push(
      or(
        ilike(registrations.passcode, term),
        ilike(registrations.surname, term),
        ilike(registrations.firstName, term),
        ilike(registrations.membershipNo, term),
        ilike(registrations.txnRef, term),
      )!,
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const [counts, attendanceCount, cats, rows, total] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        confirmed: sql<number>`count(*) filter (where ${registrations.status} = 'confirmed')::int`,
        pending: sql<number>`count(*) filter (where ${registrations.status} = 'pending')::int`,
      })
      .from(registrations),
    db.select({ n: sql<number>`count(distinct ${attendance.registrationId})::int` }).from(attendance),
    db.select().from(categories).orderBy(categories.sortOrder),
    db
      .select({
        id: registrations.id,
        passcode: registrations.passcode,
        title: registrations.title,
        surname: registrations.surname,
        firstName: registrations.firstName,
        membershipNo: registrations.membershipNo,
        email: registrations.email,
        phone: registrations.phone,
        firm: registrations.firm,
        categoryId: registrations.categoryId,
        mode: registrations.mode,
        amountKobo: registrations.amountKobo,
        txnRef: registrations.txnRef,
        proofUrl: registrations.proofUrl,
        status: registrations.status,
        rejectionReason: registrations.rejectionReason,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(where)
      .orderBy(desc(registrations.createdAt))
      .limit(PAGE_SIZE)
      .offset((pageNo - 1) * PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(registrations).where(where),
  ]);

  const c = counts[0] ?? { total: 0, confirmed: 0, pending: 0 };
  const stats = [
    { label: "Registered", value: c.total, tone: "ink" as const },
    { label: "Payment confirmed", value: c.confirmed, tone: "green" as const },
    { label: "Awaiting confirmation", value: c.pending, tone: "gold" as const },
    { label: "Attendance marked", value: attendanceCount[0]?.n ?? 0, tone: "ink" as const },
  ];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Admin dashboard</h1>
      <p className="mt-1 text-[15px] text-muted">Registrations and payment confirmation.</p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`card border-l-2 p-5 ${
              s.tone === "green" ? "border-l-green" : s.tone === "gold" ? "border-l-gold" : "border-l-ink"
            }`}
          >
            <dt className="mono text-[12px] uppercase tracking-wider text-muted">{s.label}</dt>
            <dd className="mono mt-2 text-[34px] text-ink">{s.value.toLocaleString("en-NG")}</dd>
          </div>
        ))}
      </dl>

      <RegistrationsTable
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), amount: naira(r.amountKobo) }))}
        categories={cats.map((x) => ({ id: x.id, name: x.name }))}
        total={total[0]?.n ?? 0}
        page={pageNo}
        pageSize={PAGE_SIZE}
        query={{ q, status, category }}
      />
    </div>
  );
}
