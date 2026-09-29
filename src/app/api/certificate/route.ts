import { and, eq, sql } from "drizzle-orm";
import { db, registrations, categories, events, attendance, certificates, branchSettings } from "@/db";
import { normalisePasscode } from "@/lib/passcode";
import { buildCertificate } from "@/lib/certificate";
import { dateRange } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues the certificate PDF.
 *
 * POST with the passcode in the body rather than GET with it in the path: a
 * certificate URL gets pasted into WhatsApp, and a code in the path is a code
 * in somebody's message history and in every server log along the way.
 *
 * Every condition is re-checked here. The gate on the page is there to explain
 * the wait in words; this is what actually enforces it, because a POST can be
 * sent without ever loading that page.
 */

const DEFAULT_STATEMENT =
  "participated in the {event} held on {date} at {venue}, and is hereby awarded {units} MCPD credit units.";

/** Fetches an image the branch uploaded. Never throws — a missing crest must
 *  not cost somebody their certificate. */
async function fetchImage(url: string | null): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    const type = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    return { bytes: buf, type };
  } catch {
    return null;
  }
}

/**
 * Sequential per year, zero padded: NIESV-EB/2026/0042.
 *
 * Sequential rather than random because the branch files these against a
 * register and a gap in the numbering is a question somebody can answer.
 */
async function nextSerial(prefix: string, year: number): Promise<string> {
  const like = `${prefix}/${year}/%`;
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(certificates)
    .where(sql`${certificates.serial} like ${like}`);

  const next = (rows[0]?.n ?? 0) + 1;
  return `${prefix}/${year}/${String(next).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  let raw = "";
  try {
    const body = await request.json();
    raw = String(body?.passcode ?? "");
  } catch {
    return Response.json({ error: "Enter your participation code." }, { status: 400 });
  }

  const passcode = normalisePasscode(raw);
  if (!passcode) {
    return Response.json(
      { error: "That code is incomplete. It has eight characters, for example EBY4-9K7C." },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: registrations.id,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      otherNames: registrations.otherNames,
      status: registrations.status,
      categoryName: categories.name,
      units: categories.units,
      eventTitle: events.title,
      eventTheme: events.theme,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venue,
      eventStatus: events.status,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.passcode, passcode))
    .limit(1);

  const r = rows[0];
  if (!r) {
    return Response.json({ error: "No registration found for that code." }, { status: 404 });
  }
  if (r.status !== "confirmed") {
    return Response.json(
      { error: "Your payment has not been confirmed yet. Your certificate opens once it is." },
      { status: 403 },
    );
  }

  const present = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendance)
    .where(eq(attendance.registrationId, r.id));

  if ((present[0]?.n ?? 0) === 0) {
    return Response.json(
      { error: "We have no attendance record against this code, so no certificate can be issued." },
      { status: 403 },
    );
  }

  const settingsRows = await db.select().from(branchSettings).limit(1);
  const b = settingsRows[0];

  // The serial is issued once and kept. Re-downloading must not mint a new
  // number — the first one may already be printed and hanging on a wall.
  const existing = await db
    .select({ serial: certificates.serial, unitsAwarded: certificates.unitsAwarded, issuedAt: certificates.issuedAt })
    .from(certificates)
    .where(eq(certificates.registrationId, r.id))
    .limit(1);

  let serial = existing[0]?.serial;
  let issuedAt = existing[0]?.issuedAt ?? new Date();
  let units = existing[0]?.unitsAwarded ?? r.units;

  if (!serial) {
    const prefix = (b?.certificateSerialPrefix || "NIESV-EB").replace(/[^A-Za-z0-9-]/g, "");
    serial = await nextSerial(prefix, r.startsAt.getUTCFullYear());
    units = r.units;
    issuedAt = new Date();

    try {
      await db.insert(certificates).values({
        registrationId: r.id, serial, unitsAwarded: units, issuedAt,
      });
    } catch {
      // Two tabs at once: the other request won the unique index. Use its row
      // rather than failing, so the participant simply gets their certificate.
      const again = await db
        .select({ serial: certificates.serial, unitsAwarded: certificates.unitsAwarded, issuedAt: certificates.issuedAt })
        .from(certificates)
        .where(eq(certificates.registrationId, r.id))
        .limit(1);
      if (!again[0]) {
        return Response.json({ error: "The certificate could not be issued. Try again shortly." }, { status: 500 });
      }
      serial = again[0].serial;
      units = again[0].unitsAwarded;
      issuedAt = again[0].issuedAt;
    }
  }

  const origin = new URL(request.url).origin;
  const base = (b?.canonicalUrl || origin).replace(/\/+$/, "");

  const [crest, background, chairSig, secSig] = await Promise.all([
    fetchImage(b?.logoUrl ?? null),
    fetchImage(b?.certificateBackgroundUrl ?? null),
    fetchImage(b?.chairmanSignatureUrl ?? null),
    fetchImage(b?.secretarySignatureUrl ?? null),
  ]);

  const name = [r.title, r.firstName, r.otherNames, r.surname].filter(Boolean).join(" ");

  const pdf = await buildCertificate({
    name,
    category: r.categoryName,
    units,
    serial,
    issuedAt,
    eventTitle: r.eventTitle,
    eventTheme: r.eventTheme ?? "",
    eventDate: dateRange(r.startsAt, r.endsAt),
    venue: r.venue,
    branchName: b?.branchName || "NIESV Ebonyi State Branch",
    statement: b?.certificateStatement || DEFAULT_STATEMENT,
    chairmanName: b?.chairmanName || "",
    chairmanTitle: b?.chairmanTitle || "Chairman",
    secretaryName: b?.secretaryName || "",
    secretaryTitle: b?.secretaryTitle || "Secretary",
    verifyUrl: `${base}/verify/${encodeURIComponent(serial)}`,
    verifyLabel: `${base.replace(/^https?:\/\//, "")}/verify`,
    primaryHex: b?.primaryColor || "#0B6E4F",
    accentHex: b?.accentColor || "#B08A2E",
    crest: crest?.bytes, crestType: crest?.type,
    background: background?.bytes, backgroundType: background?.type,
    chairmanSignature: chairSig?.bytes, chairmanSignatureType: chairSig?.type,
    secretarySignature: secSig?.bytes, secretarySignatureType: secSig?.type,
  });

  const filename = `Certificate-${serial.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}