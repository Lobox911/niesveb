import { eq, sql } from "drizzle-orm";
import {
  db, registrations, categories, events, attendance, certificates, branchSettings,
} from "@/db";
import { buildCertificate, type CertificateParts, type ExtraLine } from "@/lib/certificate";
import { dateRange } from "@/lib/site";
import { bundledEsvarbon } from "@/lib/brand-assets";

/**
 * One place that issues a certificate.
 *
 * It was previously inline in the public download route. Bulk issuing from the
 * dashboard needs exactly the same thing — same gates, same serial, same
 * artwork — and two copies of this logic would drift: one would get a template
 * change or a new gate and the other would not, and the branch would be
 * sending two different documents for the same seminar without knowing it.
 */

const DEFAULT_STATEMENT =
  "participated in the {event} held on {date} at {venue}, and is hereby awarded {units} MCPD credit units.";

export type IssueFailure =
  | "not-found"
  | "not-confirmed"
  | "not-attended";

export type IssueResult =
  | { ok: true; pdf: Uint8Array; serial: string; name: string; email: string; eventTitle: string; filename: string; alreadyIssued: boolean }
  | { ok: false; reason: IssueFailure; name?: string };

/** Fetches an image the branch uploaded. Never throws — a missing crest must
 *  not cost somebody their certificate. */
async function fetchImage(url: string | null): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    return { bytes, type: ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : "png" };
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
  return `${prefix}/${year}/${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** Stored as JSON. Anything unparseable falls back rather than failing. */
function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/**
 * Build the certificate for one registration.
 *
 * `skipAttendanceCheck` exists for the dashboard, where an administrator can
 * deliberately issue to someone the desk never scanned — a virtual attendee,
 * or somebody missed in a rush. It is never set from the public route: a
 * participant must not be able to talk their way past the gate, and the
 * decision to override it belongs to a named officer whose choice is audited.
 */
export async function issueCertificate(
  registrationId: string,
  origin: string,
  opts: { skipAttendanceCheck?: boolean } = {},
): Promise<IssueResult> {
  const rows = await db
    .select({
      id: registrations.id,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      otherNames: registrations.otherNames,
      email: registrations.email,
      status: registrations.status,
      categoryName: categories.name,
      units: categories.units,
      eventTitle: events.title,
      eventTheme: events.theme,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venue,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.id, registrationId))
    .limit(1);

  const r = rows[0];
  if (!r) return { ok: false, reason: "not-found" };

  const name = [r.title, r.firstName, r.otherNames, r.surname].filter(Boolean).join(" ");

  if (r.status !== "confirmed") return { ok: false, reason: "not-confirmed", name };

  if (!opts.skipAttendanceCheck) {
    const present = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendance)
      .where(eq(attendance.registrationId, r.id));
    if ((present[0]?.n ?? 0) === 0) return { ok: false, reason: "not-attended", name };
  }

  const b = (await db.select().from(branchSettings).limit(1))[0];

  /* The serial is issued once and kept. Re-running a bulk generation, or a
     participant downloading again, must not mint a second number — the first
     may already be printed and filed with national. */
  const existing = await db
    .select({ serial: certificates.serial, unitsAwarded: certificates.unitsAwarded, issuedAt: certificates.issuedAt })
    .from(certificates)
    .where(eq(certificates.registrationId, r.id))
    .limit(1);

  let serial = existing[0]?.serial;
  let issuedAt = existing[0]?.issuedAt ?? new Date();
  let units = existing[0]?.unitsAwarded ?? r.units;
  const alreadyIssued = Boolean(existing[0]);

  if (!serial) {
    const prefix = (b?.certificateSerialPrefix || "NIESV-EB").replace(/[^A-Za-z0-9-]/g, "");
    serial = await nextSerial(prefix, r.startsAt.getUTCFullYear());
    units = r.units;
    issuedAt = new Date();
    try {
      await db.insert(certificates).values({ registrationId: r.id, serial, unitsAwarded: units, issuedAt });
    } catch {
      // Two requests at once: the other won the unique index. Use its row
      // rather than failing, so the participant simply gets their certificate.
      const again = await db
        .select({ serial: certificates.serial, unitsAwarded: certificates.unitsAwarded, issuedAt: certificates.issuedAt })
        .from(certificates)
        .where(eq(certificates.registrationId, r.id))
        .limit(1);
      if (!again[0]) return { ok: false, reason: "not-found", name };
      serial = again[0].serial;
      units = again[0].unitsAwarded;
      issuedAt = again[0].issuedAt;
    }
  }

  const base = (b?.canonicalUrl || origin).replace(/\/+$/, "");

  const [crest, secondCrest, watermark, background, chairSig, secSig] = await Promise.all([
    fetchImage(b?.logoUrl ?? null),
    b?.esvarbonUrl ? fetchImage(b.esvarbonUrl) : Promise.resolve(bundledEsvarbon()),
    fetchImage(b?.certificateWatermarkUrl ?? null),
    fetchImage(b?.certificateBackgroundUrl ?? null),
    fetchImage(b?.chairmanSignatureUrl ?? null),
    fetchImage(b?.secretarySignatureUrl ?? null),
  ]);

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
    institutionName: b?.institutionName || "Nigerian Institution of Estate Surveyors and Valuers",
    headingText: b?.certificateHeading || "Certificate of Participation",
    chairmanName: b?.chairmanName || "",
    chairmanTitle: b?.chairmanTitle || "Chairman",
    chairmanPostNominals: b?.chairmanPostNominals || "",
    secretaryName: b?.secretaryName || "",
    secretaryTitle: b?.secretaryTitle || "Secretary",
    secretaryPostNominals: b?.secretaryPostNominals || "",
    verifyUrl: `${base}/verify/${encodeURIComponent(serial)}`,
    verifyLabel: `${base.replace(/^https?:\/\//, "")}/verify`,
    /* The certificate's own pair, not the site's green and gold. */
    primaryHex: b?.certificatePrimary || "#001E4C",
    accentHex: b?.certificateAccent || "#EA0411",
    watermarkOpacity: (b?.certificateWatermark ?? 5) / 100,
    crest: crest?.bytes, crestType: crest?.type,
    secondCrest: secondCrest?.bytes, secondCrestType: secondCrest?.type,
    watermark: watermark?.bytes, watermarkType: watermark?.type,
    background: background?.bytes, backgroundType: background?.type,
    chairmanSignature: chairSig?.bytes, chairmanSignatureType: chairSig?.type,
    secretarySignature: secSig?.bytes, secretarySignatureType: secSig?.type,
    parts: parse<CertificateParts>(b?.certificateParts, {}),
    extraLines: parse<ExtraLine[]>(b?.certificateExtraLines, []),
  });

  return {
    ok: true,
    pdf,
    serial,
    name,
    email: r.email,
    eventTitle: r.eventTitle,
    filename: `Certificate-${serial.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
    alreadyIssued,
  };
}