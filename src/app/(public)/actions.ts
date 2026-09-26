"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, or, sql } from "drizzle-orm";
import { db, registrations, categories, events, attendance, certificates } from "@/db";
import { generatePasscode, normalisePasscode } from "@/lib/passcode";
import { naira, dateRange } from "@/lib/site";
import { sendPasscodeEmail } from "@/lib/email";

/**
 * Public registration. No authentication — anyone can register — so every
 * value is re-validated here rather than trusted from the form, and the fee
 * is read from the database rather than taken from the submitted amount.
 */

const RECEIPT_COOKIE = "niesv_last_registration";

/**
 * A URL arriving from the browser is an untrusted string, and it ends up in an
 * `href` on the admin screen. Accepting only our own Blob host means a
 * submitted `javascript:` or an attacker's link cannot be planted there for an
 * officer to click while reviewing payments.
 */
function blobUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function siteUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function submitRegistration(_prev: unknown, formData: FormData) {
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) return { error: "Select your participation category." };

  // The category carries the event and the fee. Reading both from the database
  // means a tampered form cannot register for a closed event or pay less.
  const rows = await db
    .select({
      cat: categories,
      ev: events,
    })
    .from(categories)
    .innerJoin(events, eq(events.id, categories.eventId))
    .where(eq(categories.id, categoryId))
    .limit(1);

  const found = rows[0];
  if (!found) return { error: "That category is no longer available. Reload the page and try again." };
  if (found.ev.status !== "open") {
    return { error: "Registration for this event has closed." };
  }
  if (found.ev.registrationDeadline && found.ev.registrationDeadline < new Date()) {
    return { error: "The registration deadline for this event has passed." };
  }

  const { cat, ev } = found;

  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const surname = text("surname");
  const firstName = text("firstName");
  const email = text("email").toLowerCase();
  const phone = text("phone").replace(/\D/g, "");
  const membershipNo = text("membershipNo").toUpperCase() || null;
  const txnRef = text("txnRef");
  const mode = text("mode") === "virtual" ? "virtual" : "physical";

  if (!surname) return { error: "Enter your surname." };
  if (!firstName) return { error: "Enter your first name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address. Your passcode and certificate are sent there." };
  }
  if (phone.length !== 11) return { error: "Enter an 11-digit phone number." };
  if (cat.requiresMembershipNo && !membershipNo) {
    return { error: "Enter your NIESV membership number for this category." };
  }
  if (!txnRef) return { error: "Enter the transaction reference or teller number from your payment." };

  const proofUrl = blobUrl(text("proofUrl"));
  if (!proofUrl) {
    return { error: "Attach the teller or receipt for your payment, and wait for it to finish uploading before submitting." };
  }

  // Duplicates are per event: attending last year must not block this year.
  if (membershipNo) {
    const dupe = await db
      .select({ passcode: registrations.passcode })
      .from(registrations)
      .where(and(eq(registrations.eventId, ev.id), eq(registrations.membershipNo, membershipNo)))
      .limit(1);
    if (dupe[0]) {
      return {
        error: `Membership number ${membershipNo} is already registered for this event. Use "Retrieve code" to get your passcode.`,
        duplicate: true,
      };
    }
  }

  // A passcode must be globally unique — the gates are given nothing else to
  // identify a registration by. Collisions are vanishingly unlikely with this
  // alphabet, but retrying costs nothing and guessing wrong is unrecoverable.
  let passcode = generatePasscode();
  for (let i = 0; i < 5; i++) {
    const taken = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.passcode, passcode))
      .limit(1);
    if (!taken[0]) break;
    passcode = generatePasscode();
  }

  const [saved] = await db
    .insert(registrations)
    .values({
      eventId: ev.id,
      passcode,
      title: text("title") || null,
      surname,
      firstName,
      otherNames: text("otherNames") || null,
      membershipNo,
      email,
      phone,
      categoryId: cat.id,
      mode,
      consentPublish: formData.get("consent") === "on",
      amountKobo: cat.feeKobo,
      txnRef,
      proofUrl,
      status: "pending",
    })
    .returning({ id: registrations.id });

  // Short-lived cookie rather than a query parameter: the success page needs
  // the passcode, but a code in the URL ends up in browser history and in any
  // link the participant pastes to someone else.
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, saved.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  // Email is best effort. A failure here must not lose the registration —
  // the passcode is already saved and shown on the next screen.
  await sendPasscodeEmail({
    to: email,
    name: `${text("title")} ${firstName} ${surname}`.trim(),
    passcode,
    eventTitle: ev.title,
    eventDate: dateRange(ev.startsAt, ev.endsAt),
    venue: ev.venue,
    amountLabel: naira(cat.feeKobo),
    siteUrl: await siteUrl(),
  }).catch(() => false);

  redirect("/register/success");
}

/** Reads the registration the cookie points at, for the success page. */
export async function getReceipt() {
  const jar = await cookies();
  const id = jar.get(RECEIPT_COOKIE)?.value;
  if (!id) return null;

  const rows = await db
    .select({
      passcode: registrations.passcode,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      email: registrations.email,
      mode: registrations.mode,
      status: registrations.status,
      amountKobo: registrations.amountKobo,
      categoryName: categories.name,
      eventTitle: events.title,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.id, id))
    .limit(1);

  return rows[0] ?? null;
}

/** Retrieve a passcode by membership number or email. */
export async function retrievePasscode(_prev: unknown, formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) return { error: "Enter your membership number or email address." };

  const rows = await db
    .select({
      passcode: registrations.passcode,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      email: registrations.email,
      categoryName: categories.name,
      eventTitle: events.title,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(
      or(
        eq(registrations.membershipNo, q.toUpperCase()),
        eq(registrations.email, q.toLowerCase()),
      )!,
    )
    .orderBy(sql`${registrations.createdAt} desc`)
    .limit(1);

  const r = rows[0];
  if (!r) {
    return { error: "No registration found for that membership number or email address." };
  }

  const [user, domain] = r.email.split("@");
  return {
    ok: true,
    passcode: r.passcode,
    name: `${r.title ?? ""} ${r.firstName} ${r.surname}`.trim(),
    email: `${user.slice(0, 1)}***@${domain}`,
    category: r.categoryName,
    eventTitle: r.eventTitle,
  };
}

/** Shared by the photo card, join and certificate gates. */
export async function verifyPasscode(raw: string) {
  const passcode = normalisePasscode(raw);
  if (!passcode) {
    return { error: "That code is incomplete. It has eight characters, for example EBY4-9K7C." };
  }

  const rows = await db
    .select({
      id: registrations.id,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      mode: registrations.mode,
      status: registrations.status,
      photoUrl: registrations.photoUrl,
      categoryName: categories.name,
      units: categories.units,
      eventId: events.id,
      eventTitle: events.title,
      eventStatus: events.status,
      meetingUrl: events.meetingUrl,
      meetingId: events.meetingId,
      startsAt: events.startsAt,
    })
    .from(registrations)
    .innerJoin(categories, eq(categories.id, registrations.categoryId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.passcode, passcode))
    .limit(1);

  const r = rows[0];
  if (!r) {
    return { error: `No registration found for ${passcode}. Check for the letter O against the digit 0.` };
  }

  const [marked, cert] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(attendance).where(eq(attendance.registrationId, r.id)),
    db.select({ serial: certificates.serial }).from(certificates).where(eq(certificates.registrationId, r.id)).limit(1),
  ]);

  return {
    ok: true,
    passcode,
    name: `${r.title ?? ""} ${r.firstName} ${r.surname}`.trim(),
    category: r.categoryName,
    units: r.units,
    mode: r.mode,
    status: r.status,
    photoUrl: r.photoUrl,
    eventTitle: r.eventTitle,
    eventStatus: r.eventStatus,
    meetingUrl: r.meetingUrl,
    meetingId: r.meetingId,
    startsAt: r.startsAt.toISOString(),
    attended: (marked[0]?.n ?? 0) > 0,
    certificateSerial: cert[0]?.serial ?? null,
  };
}