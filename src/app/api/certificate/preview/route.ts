import { desc, eq } from "drizzle-orm";
import { db, branchSettings, events, categories } from "@/db";
import { requireOfficer } from "@/lib/auth";
import { buildCertificate, type CertificateParts, type ExtraLine } from "@/lib/certificate";
import { dateRange } from "@/lib/site";
import { bundledEsvarbon } from "@/lib/brand-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Draws a certificate from settings that have not been saved yet.
 *
 * Without this the only way to see a change is to save it, find a confirmed
 * and attended participant, and download theirs — so the branch would be
 * editing the document 200 people receive without ever looking at it.
 *
 * Dummy participant, obviously fake serial. It is the layout being checked,
 * not anybody's record, and nothing here touches the certificates table.
 */

const DEFAULT_STATEMENT =
  "participated in the {event} held on {date} at {venue}, and is hereby awarded {units} MCPD credit units.";

async function fetchImage(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    return { bytes, type: (ct.includes("jp") ? "jpg" : "png") as "png" | "jpg" };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Branch settings and the crest. Officer sign-in required.
  await requireOfficer();

  let body: {
    parts?: CertificateParts;
    extraLines?: ExtraLine[];
    statement?: string;
    chairmanName?: string;
    chairmanTitle?: string;
    secretaryName?: string;
    secretaryTitle?: string;
    serialPrefix?: string;
    backgroundUrl?: string | null;
    chairmanSignatureUrl?: string | null;
    secretarySignatureUrl?: string | null;
    esvarbonUrl?: string | null;
    watermarkUrl?: string | null;
    chairmanPostNominals?: string;
    secretaryPostNominals?: string;
    heading?: string;
    institutionName?: string;
    primaryHex?: string;
    accentHex?: string;
    watermark?: number;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const settings = (await db.select().from(branchSettings).limit(1))[0];

  // Each image can be overridden by the draft, including to null — that is how
  // "Remove" is previewed before it is saved.
  const pick = (draft: string | null | undefined, saved: string | null | undefined) =>
    draft === undefined ? (saved ?? null) : draft;

  /* The same fallback the issuing route uses. Without it the preview showed
     an empty top right while a real certificate printed the crest. */
  const esvarbon = pick(body.esvarbonUrl, settings?.esvarbonUrl);

  const [crest, secondCrest, watermark, background, chairSig, secSig] = await Promise.all([
    fetchImage(settings?.logoUrl ?? null),
    esvarbon ? fetchImage(esvarbon) : Promise.resolve(bundledEsvarbon()),
    fetchImage(pick(body.watermarkUrl, settings?.certificateWatermarkUrl)),
    fetchImage(pick(body.backgroundUrl, settings?.certificateBackgroundUrl)),
    fetchImage(pick(body.chairmanSignatureUrl, settings?.chairmanSignatureUrl)),
    fetchImage(pick(body.secretarySignatureUrl, settings?.secretarySignatureUrl)),
  ]);

  const prefix = (body.serialPrefix || settings?.certificateSerialPrefix || "NIESV-EB")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase();

  /* The sample is drawn from the real event rather than invented, so the
     preview shows the theme and venue that will actually print. Checking a
     layout against made-up text proves less than it looks like it does —
     a theme two words long wraps differently from the real one. */
  const ev =
    (await db.select().from(events).where(eq(events.isFeatured, true)).limit(1))[0]
    ?? (await db.select().from(events).orderBy(desc(events.startsAt)).limit(1))[0];

  const cat = ev
    ? (await db.select({ name: categories.name, units: categories.units })
        .from(categories).where(eq(categories.eventId, ev.id)).limit(1))[0]
    : undefined;

  const pdf = await buildCertificate({
    name: "Esv. Anyanwu Jonathan",
    category: cat?.name ?? "Members",
    units: cat?.units ?? 3,
    // Obviously a sample, so nobody mistakes a preview for a real certificate.
    serial: `${prefix}/${new Date().getFullYear()}/SAMPLE`,
    issuedAt: new Date(),
    eventTitle: ev?.title ?? "MCPD Seminar",
    eventTheme: ev?.theme ?? "",
    eventDate: ev ? dateRange(ev.startsAt, ev.endsAt) : "",
    venue: ev?.venue ?? "",
    branchName: settings?.branchName || "NIESV Ebonyi State Branch",
    statement: body.statement?.trim() || settings?.certificateStatement || DEFAULT_STATEMENT,
    institutionName: body.institutionName || settings?.institutionName
      || "Nigerian Institution of Estate Surveyors and Valuers",
    headingText: body.heading || settings?.certificateHeading || "Certificate of Participation",
    chairmanName: body.chairmanName ?? settings?.chairmanName ?? "",
    chairmanTitle: body.chairmanTitle ?? settings?.chairmanTitle ?? "Chairman",
    chairmanPostNominals: body.chairmanPostNominals ?? settings?.chairmanPostNominals ?? "",
    secretaryName: body.secretaryName ?? settings?.secretaryName ?? "",
    secretaryTitle: body.secretaryTitle ?? settings?.secretaryTitle ?? "Secretary",
    secretaryPostNominals: body.secretaryPostNominals ?? settings?.secretaryPostNominals ?? "",
    verifyUrl: `${settings?.canonicalUrl || new URL(request.url).origin}/verify/sample`,
    verifyLabel: `${(settings?.canonicalUrl || new URL(request.url).origin).replace(/^https?:\/\//, "")}/verify`,
    primaryHex: body.primaryHex || settings?.certificatePrimary || "#001E4C",
    accentHex: body.accentHex || settings?.certificateAccent || "#EA0411",
    watermarkOpacity: (body.watermark ?? settings?.certificateWatermark ?? 5) / 100,
    crest: crest?.bytes, crestType: crest?.type,
    secondCrest: secondCrest?.bytes, secondCrestType: secondCrest?.type,
    watermark: watermark?.bytes, watermarkType: watermark?.type,
    background: background?.bytes, backgroundType: background?.type,
    chairmanSignature: chairSig?.bytes, chairmanSignatureType: chairSig?.type,
    secretarySignature: secSig?.bytes, secretarySignatureType: secSig?.type,
    parts: body.parts,
    extraLines: body.extraLines,
  });

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // Inline rather than attachment: this is for looking at, not keeping.
      "Content-Disposition": "inline; filename=\"certificate-preview.pdf\"",
      "Cache-Control": "no-store",
    },
  });
}