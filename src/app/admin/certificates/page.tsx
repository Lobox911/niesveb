import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, registrations, categories, events, attendance, certificates } from "@/db";
import { requireOfficer } from "@/lib/auth";
import CertificatesPanel from "./CertificatesPanel";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

/**
 * Issuing certificates for a whole seminar.
 *
 * The screen is built around one distinction: who actually attended. The
 * certificate awards MCPD credit units, and those units go into a member's
 * record with NIESV and ESVARBON. Issuing them to somebody who paid and never
 * came is a false statement by the branch, so the two groups are separated and
 * only the attended group is selected by default.
 *
 * The unattended group is listed rather than hidden, because real cases exist
 * — a virtual attendee nobody scanned, someone the desk missed. Including them
 * is then a decision an officer made, not a default nobody noticed.
 */
export default async function CertificatesPage({
  searchParams,
}: { searchParams: Promise<{ event?: string }> }) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const { event: wantedEvent } = await searchParams;

  const allEvents = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, isFeatured: events.isFeatured })
    .from(events)
    .orderBy(desc(events.startsAt));

  /* Default to the featured event, then the most recent. The branch is almost
     always working on the seminar that just happened. */
  const selected =
    allEvents.find((e) => e.id === wantedEvent) ??
    allEvents.find((e) => e.isFeatured) ??
    allEvents[0];

  if (!selected) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-[26px] text-ink">Certificates</h1>
        <div className="card mt-8 p-10 text-center">
          <p className="text-[17px] text-ink">No events yet</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-muted">
            Certificates are issued against an event. Create one first.
          </p>
        </div>
      </div>
    );
  }

  const rows = await db
    .select({
      id: registrations.id,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      email: registrations.email,
      passcode: registrations.passcode,
      mode: registrations.mode,
      categoryName: categories.name,
      units: categories.units,
      scans: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.registrationId} = ${registrations.id}
      )`,
      serial: sql<string | null>`(
        select ${certificates.serial} from ${certificates}
        where ${certificates.registrationId} = ${registrations.id} limit 1
      )`,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .where(and(eq(registrations.eventId, selected.id), eq(registrations.status, "confirmed")))
    .orderBy(asc(registrations.surname), asc(registrations.firstName));

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Certificates</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        Issue and email certificates for an event. Preview one before sending
        any, and check the wording and signatures under Site settings first.
      </p>

      <CertificatesPanel
        events={allEvents.map((e) => ({
          id: e.id,
          title: e.title,
          year: e.startsAt.getUTCFullYear(),
        }))}
        eventId={selected.id}
        eventTitle={selected.title}
        rows={rows.map((r) => ({
          id: r.id,
          name: [r.title, r.firstName, r.surname].filter(Boolean).join(" "),
          email: r.email,
          passcode: r.passcode,
          mode: r.mode,
          category: r.categoryName,
          units: r.units,
          attended: r.scans > 0,
          serial: r.serial,
        }))}
      />
    </div>
  );
}