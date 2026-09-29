import { and, asc, eq, sql } from "drizzle-orm";
import { db, registrations, categories, events, attendance, certificates } from "@/db";
import { requireOfficer } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The participant list, as a spreadsheet.
 *
 * Needed for the venue, the caterer and the return to NIESV national, and
 * needed on a morning when nobody is going to debug anything. So: no
 * pagination, no streaming, one query and one file.
 *
 * Excel is the only thing this will ever be opened in, which drives two
 * decisions below — the BOM and the leading apostrophe on phone numbers.
 */

/**
 * RFC 4180 quoting, plus one defence against Excel.
 *
 * A cell beginning with =, +, - or @ is treated as a formula when the file is
 * opened, which at best mangles a phone number and at worst runs something. A
 * leading apostrophe forces Excel to treat it as text, and is invisible in the
 * cell.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(values: unknown[]): string {
  return values.map(cell).join(",");
}

/** Lagos time, and a format Excel parses rather than treats as text. */
function stamp(d: Date | null): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Africa/Lagos",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function GET(request: Request) {
  // Participant names, emails and phone numbers. Officer sign-in required.
  const officer = await requireOfficer();

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("category");
  const eventId = url.searchParams.get("event");
  const attendedOnly = url.searchParams.get("attended") === "1";

  const filters = [];
  if (status === "pending" || status === "confirmed" || status === "rejected") {
    filters.push(eq(registrations.status, status));
  }
  if (categoryId) filters.push(eq(registrations.categoryId, categoryId));
  if (eventId) filters.push(eq(registrations.eventId, eventId));

  const rows = await db
    .select({
      passcode: registrations.passcode,
      title: registrations.title,
      surname: registrations.surname,
      firstName: registrations.firstName,
      otherNames: registrations.otherNames,
      membershipNo: registrations.membershipNo,
      email: registrations.email,
      phone: registrations.phone,
      firm: registrations.firm,
      categoryName: categories.name,
      units: categories.units,
      mode: registrations.mode,
      amountKobo: registrations.amountKobo,
      txnRef: registrations.txnRef,
      proofUrl: registrations.proofUrl,
      status: registrations.status,
      rejectionReason: registrations.rejectionReason,
      consentPublish: registrations.consentPublish,
      createdAt: registrations.createdAt,
      confirmedAt: registrations.confirmedAt,
      eventTitle: events.title,
      // Subqueries rather than joins: a join to an append-only attendance
      // table multiplies rows, and a double scan would produce two lines for
      // one participant in the export the branch counts heads from.
      attendanceCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.registrationId} = ${registrations.id}
      )`,
      firstSeen: sql<Date | null>`(
        select min(${attendance.markedAt}) from ${attendance}
        where ${attendance.registrationId} = ${registrations.id}
      )`,
      certificateSerial: sql<string | null>`(
        select ${certificates.serial} from ${certificates}
        where ${certificates.registrationId} = ${registrations.id} limit 1
      )`,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(registrations.surname), asc(registrations.firstName));

  const wanted = attendedOnly ? rows.filter((r) => r.attendanceCount > 0) : rows;

  const header = [
    "Passcode", "Title", "Surname", "First name", "Other names",
    "Membership no", "Email", "Phone", "Firm",
    "Category", "MCPD units", "Attendance mode",
    "Amount (NGN)", "Payment reference", "Proof of payment",
    "Payment status", "Rejection reason",
    "Attended", "First scanned", "Scans",
    "Certificate serial", "Consent to publish",
    "Registered", "Confirmed", "Event",
  ];

  const body = wanted.map((r) =>
    row([
      r.passcode ?? "Not issued",
      r.title, r.surname, r.firstName, r.otherNames,
      r.membershipNo,
      r.email,
      // Excel eats the leading zero on 0803… and shows 803…, which makes the
      // export useless for actually ringing anyone.
      r.phone ? `'${r.phone}` : "",
      r.firm,
      r.categoryName,
      r.units,
      r.mode === "virtual" ? "Virtual" : "Physical",
      (r.amountKobo / 100).toFixed(2),
      r.txnRef,
      r.proofUrl,
      r.status,
      r.rejectionReason,
      r.attendanceCount > 0 ? "Yes" : "No",
      stamp(r.firstSeen ? new Date(r.firstSeen) : null),
      r.attendanceCount,
      r.certificateSerial,
      r.consentPublish ? "Yes" : "No",
      stamp(r.createdAt),
      stamp(r.confirmedAt),
      r.eventTitle,
    ]),
  );

  // The BOM is what makes Excel read this as UTF-8. Without it, a name with
  // an accent arrives mangled and the branch assumes the export is broken.
  const csv = "﻿" + [row(header), ...body].join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  const label = [status, attendedOnly ? "attended" : null].filter(Boolean).join("-");
  const filename = `registrations-${label ? `${label}-` : ""}${today}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      // Downloaded by a signed-in officer and carrying personal data: never
      // let a proxy or the browser keep a copy.
      "X-Robots-Tag": "noindex",
      "X-Exported-By": officer.id,
    },
  });
}