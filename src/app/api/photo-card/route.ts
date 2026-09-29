import { eq } from "drizzle-orm";
import { db, registrations, categories, events, branchSettings } from "@/db";
import { normalisePasscode } from "@/lib/passcode";
import { buildPhotoCard } from "@/lib/photocard";
import { dateRange } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel caps a function request at 4.5MB; the cropped photo arrives inline
 *  as a data URL, so it is capped well below that. The browser crops to 600px
 *  square before sending, which lands around 80KB. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/**
 * Decodes the cropped photograph the browser sends.
 *
 * Only PNG and JPEG, and the magic bytes are checked rather than trusting the
 * declared type — this is unauthenticated input being handed to an image
 * parser, and the declared type is whatever the sender says it is.
 */
function decodePhoto(dataUrl: unknown): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  if (typeof dataUrl !== "string") return null;

  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(m[2], "base64"));
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null;

  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isPng) return { bytes, type: "png" };
  if (isJpg) return { bytes, type: "jpg" };
  return null;
}

async function fetchImage(url: string | null): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    return { bytes, type: ct.includes("jp") ? "jpg" : "png" };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: { passcode?: unknown; photo?: unknown; print?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your participation code." }, { status: 400 });
  }

  const passcode = normalisePasscode(String(body.passcode ?? ""));
  if (!passcode) {
    return Response.json(
      { error: "That code is incomplete. It has eight characters, for example EBY4-9K7C." },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      title: registrations.title,
      firstName: registrations.firstName,
      otherNames: registrations.otherNames,
      surname: registrations.surname,
      membershipNo: registrations.membershipNo,
      mode: registrations.mode,
      status: registrations.status,
      categoryName: categories.name,
      eventTitle: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.passcode, passcode))
    .limit(1);

  const r = rows[0];
  if (!r) return Response.json({ error: "No registration found for that code." }, { status: 404 });

  // A badge is what gets someone into the room, so it follows payment. The
  // certificate additionally needs attendance; this does not, because the
  // badge is what produces the attendance record in the first place.
  if (r.status !== "confirmed") {
    return Response.json(
      { error: "Your payment has not been confirmed yet. Your card becomes available once it is." },
      { status: 403 },
    );
  }

  const photo = decodePhoto(body.photo);
  const settings = (await db.select().from(branchSettings).limit(1))[0];
  const crest = await fetchImage(settings?.logoUrl ?? null);

  const pdf = await buildPhotoCard({
    name: [r.title, r.firstName, r.otherNames, r.surname].filter(Boolean).join(" "),
    category: r.categoryName,
    membershipNo: r.membershipNo ?? "",
    passcode,
    mode: r.mode,
    eventTitle: r.eventTitle,
    eventDate: dateRange(r.startsAt, r.endsAt),
    branchName: settings?.branchName || "NIESV Ebonyi State Branch",
    primaryHex: settings?.primaryColor || "#0B6E4F",
    accentHex: settings?.accentColor || "#B08A2E",
    photo: photo?.bytes,
    photoType: photo?.type,
    crest: crest?.bytes,
    crestType: crest?.type,
    forPrinting: body.print === true,
  });

  const filename = `Participant-card-${passcode}.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // The photograph is never written to disk — it arrives, is drawn into
      // the PDF, and goes out again. Nothing to leak later.
      "Cache-Control": "no-store",
    },
  });
}