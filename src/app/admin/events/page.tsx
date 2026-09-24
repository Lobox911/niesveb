import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db, events } from "@/db";
import { requireOfficer } from "@/lib/auth";
import { dateRange } from "@/lib/site";
import EventActions from "./EventActions";

export const metadata: Metadata = { title: "Events" };

const STATUS_TONE: Record<string, string> = {
  open: "border-green/40 bg-green/10 text-green",
  closed: "border-gold/40 bg-gold/10 text-gold",
  draft: "border-line bg-paper text-muted",
  archived: "border-line bg-paper text-muted",
};

/**
 * Every seminar the branch has run or is planning. One is featured on the
 * home page; several can be open for registration at once.
 */
export default async function EventsPage() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const rows = await db.select().from(events).orderBy(desc(events.startsAt));

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] text-ink">Events</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">
            Each seminar has its own fees, programme and flyer. The featured
            event leads the home page; any event set to open accepts
            registrations.
          </p>
        </div>
        <Link href="/admin/events/new" className="btn-primary">Add an event</Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 rounded border border-line bg-white p-8 text-center text-[15px] text-muted">
          No events yet. Add one to open registration.
        </p>
      ) : (
        <ul className="mt-8 max-w-[760px]">
          {rows.map((e) => (
            <li key={e.id} className="card mb-3 flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold text-ink">
                  {e.title}
                  {e.isFeatured && (
                    <span className="mono ml-3 rounded border border-green/40 bg-green/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-green">
                      Featured
                    </span>
                  )}
                </p>
                <p className="mono mt-1 text-[13px] text-muted">
                  {dateRange(e.startsAt, e.endsAt)} · {e.slug}
                </p>
              </div>

              <span className={`mono rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${STATUS_TONE[e.status]}`}>
                {e.status}
              </span>

              <div className="flex gap-2">
                <Link href={`/admin/events/${e.id}`} className="btn-secondary px-3">Edit</Link>
                <EventActions id={e.id} isFeatured={e.isFeatured} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}