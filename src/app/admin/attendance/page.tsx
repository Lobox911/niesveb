import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db, attendance } from "@/db";
import { requireOfficer } from "@/lib/auth";
import AttendanceDesk from "./AttendanceDesk";

export const metadata: Metadata = { title: "Attendance desk" };

export default async function AttendancePage() {
  await requireOfficer();
  const marked = await db
    .select({ n: sql<number>`count(distinct ${attendance.registrationId})::int` })
    .from(attendance);

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Attendance desk</h1>
      <p className="mt-1 text-[15px] text-muted">
        Enter a participant&rsquo;s passcode to mark them present.
      </p>
      <AttendanceDesk markedCount={marked[0]?.n ?? 0} />
    </div>
  );
}
