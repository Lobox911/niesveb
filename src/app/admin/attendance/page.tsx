import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, attendance, registrations, categories, events } from "@/db";
import { requireOfficer } from "@/lib/auth";
import AttendanceDesk from "./AttendanceDesk";
import AttendanceRoll from "./AttendanceRoll";

export const metadata: Metadata = { title: "Attendance desk" };
export const dynamic = "force-dynamic";

/**
 * The desk and the roll on one screen.
 *
 * On the day the registrar is scanning codes and the chairman is asking how
 * many are in the room. Those are the same screen, refreshed, not two.
 */
export default async function AttendancePage() {
  await requireOfficer();

  // Attendance belongs to the event being held, not to every event ever run,
  // so last year's numbers do not inflate this morning's count.
  const featuredRows = await db
    .select()
    .from(events)
    .where(eq(events.isFeatured, true))
    .limit(1);

  const fallback = featuredRows[0]
    ? null
    : (await db.select().from(events).where(eq(events.status, "open")).orderBy(asc(events.startsAt)).limit(1))[0];

  const event = featuredRows[0] ?? fallback ?? null;

  if (!event) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-[26px] text-ink">Attendance desk</h1>
        <p className="mt-3 max-w-prose text-[15px] text-muted">
          There is no featured or open event, so there is nobody to mark
          present. Publish an event first.
        </p>
      </div>
    );
  }

  const rows = await db
    .select({
      id: registrations.id,
      passcode: registrations.passcode,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      membershipNo: registrations.membershipNo,
      mode: registrations.mode,
      status: registrations.status,
      categoryName: categories.name,
      scans: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.registrationId} = ${registrations.id}
      )`,
      firstSeen: sql<Date | null>`(
        select min(${attendance.markedAt}) from ${attendance}
        where ${attendance.registrationId} = ${registrations.id}
      )`,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .where(and(eq(registrations.eventId, event.id), eq(registrations.status, "confirmed")))
    .orderBy(asc(registrations.surname), asc(registrations.firstName));

  const present = rows.filter((r) => r.scans > 0);
  const expected = rows.length;

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Attendance desk</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        {event.title}. Enter a participant&rsquo;s code to mark them present.
        Only confirmed registrations appear below — anyone still awaiting
        payment confirmation has no code yet.
      </p>

      <AttendanceDesk markedCount={present.length} />

      <AttendanceRoll
        rows={rows.map((r) => ({
          id: r.id,
          passcode: r.passcode ?? "",
          name: [r.title, r.firstName, r.surname].filter(Boolean).join(" "),
          membershipNo: r.membershipNo ?? "",
          category: r.categoryName,
          mode: r.mode,
          scans: r.scans,
          firstSeen: r.firstSeen ? new Date(r.firstSeen).toISOString() : null,
        }))}
        expected={expected}
        present={present.length}
      />
    </div>
  );
}