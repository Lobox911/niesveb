import { db, branchSettings } from "@/db";
import { requireOfficer } from "@/lib/auth";
import { buildCertificate, type CertificateParts, type ExtraLine } from "@/lib/certificate";

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

  const [crest, background, chairSig, secSig] = await Promise.all([
    fetchImage(settings?.logoUrl ?? null),
    fetchImage(pick(body.backgroundUrl, settings?.certificateBackgroundUrl)),
    fetchImage(pick(body.chairmanSignatureUrl, settings?.chairmanSignatureUrl)),
    fetchImage(pick(body.secretarySignatureUrl, settings?.secretarySignatureUrl)),
  ]);

  const prefix = (body.serialPrefix || settings?.certificateSerialPrefix || "NIESV-EB")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase();

  const pdf = await buildCertificate({
    name: "Esv. Chinedu Obiageli Okafor",
    category: "Members",
    units: 12,
    // Obviously a sample, so nobody mistakes a preview for a real certificate.
    serial: `${prefix}/${new Date().getFullYear()}/SAMPLE`,
    issuedAt: new Date(),
    eventTitle: "2026 MCPD Seminar",
    eventTheme: "Valuation in a Volatile Economy",
    eventDate: "25-26 March 2026",
    venue: "Cititrust Hotel, Abakaliki",
    branchName: settings?.branchName || "NIESV Ebonyi State Branch",
    statement: body.statement?.trim() || settings?.certificateStatement || DEFAULT_STATEMENT,
    chairmanName: body.chairmanName ?? settings?.chairmanName ?? "",
    chairmanTitle: body.chairmanTitle ?? settings?.chairmanTitle ?? "Chairman",
    secretaryName: body.secretaryName ?? settings?.secretaryName ?? "",
    secretaryTitle: body.secretaryTitle ?? settings?.secretaryTitle ?? "Secretary",
    verifyUrl: `${settings?.canonicalUrl || new URL(request.url).origin}/verify/sample`,
    verifyLabel: `${(settings?.canonicalUrl || new URL(request.url).origin).replace(/^https?:\/\//, "")}/verify`,
    primaryHex: settings?.primaryColor || "#0B6E4F",
    accentHex: settings?.accentColor || "#B08A2E",
    crest: crest?.bytes, crestType: crest?.type,
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