"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  db, registrations, attendance, auditLog, branchSettings, events, categories, officers,
  heroSlides, advertRates, programmeItems, pages,
} from "@/db";
import { authenticate, createSession, destroySession, requireOfficer, hashPassword } from "@/lib/auth";
import { normalisePasscode, generatePasscode } from "@/lib/passcode";
import { dateRange, getBranch } from "@/lib/site";
import { SYSTEM_PAGES, systemPage, slugify, RESERVED_SLUGS } from "@/lib/pages";
import { headers } from "next/headers";
import { sendCertificateReadyEmail, sendConfirmedEmail, sendRejectedEmail } from "@/lib/email";
import { del } from "@vercel/blob";

/** The address to put in emails. Prefers the branch's canonical setting and
 *  falls back to the request host, so links work before it is filled in. */
async function publicUrl(): Promise<string> {
  const branch = await getBranch();
  if (branch.canonicalUrl) return branch.canonicalUrl;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

/* ---------- auth ---------- */

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const officer = await authenticate(email, password);
  if (!officer) return { error: "That email and password do not match an active officer account." };

  await createSession(officer);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/* ---------- audit ---------- */

/** Every state change writes a row. This is money handling: who, what, when. */
async function audit(officerId: string, action: string, table: string, targetId: string, detail?: unknown) {
  await db.insert(auditLog).values({
    officerId, action, targetTable: table, targetId,
    detail: detail ? JSON.stringify(detail) : null,
  });
}

/* ---------- payment verification ---------- */

/**
 * A passcode must be globally unique — the gates are given nothing else to
 * identify a registration by. Collisions are vanishingly unlikely with this
 * alphabet, but retrying costs nothing and guessing wrong is unrecoverable.
 */
async function freshPasscode(): Promise<string> {
  let code = generatePasscode();
  for (let i = 0; i < 5; i++) {
    const taken = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.passcode, code))
      .limit(1);
    if (!taken[0]) return code;
    code = generatePasscode();
  }
  return code;
}

/**
 * Confirming a payment is what issues the participation code. Before this
 * moment the registration has none, so nobody can join the session, print a
 * photo card or be marked present on the strength of a form submission alone.
 *
 * Re-confirming a registration that already has a code keeps it: the code may
 * already be in the participant's hands, and rotating it silently would lock
 * them out.
 */
export async function confirmPayment(id: string) {
  const officer = await requireOfficer();

  const existing = await db
    .select({ passcode: registrations.passcode })
    .from(registrations)
    .where(eq(registrations.id, id))
    .limit(1);
  if (!existing[0]) return { error: "That registration no longer exists." };

  const passcode = existing[0].passcode ?? (await freshPasscode());

  const [reg] = await db
    .update(registrations)
    .set({
      status: "confirmed",
      passcode,
      confirmedBy: officer.id,
      confirmedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(registrations.id, id))
    .returning({
      email: registrations.email, title: registrations.title,
      firstName: registrations.firstName, surname: registrations.surname,
      eventId: registrations.eventId,
    });

  // Best effort: a mail failure must not undo a confirmed payment. The code is
  // returned either way so the officer can read it out to someone paying at
  // the desk, who will not wait for an inbox.
  if (reg) {
    const ev = await db
      .select({ title: events.title, startsAt: events.startsAt, endsAt: events.endsAt, venue: events.venue })
      .from(events).where(eq(events.id, reg.eventId)).limit(1);

    await sendConfirmedEmail({
      to: reg.email,
      name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
      passcode,
      eventTitle: ev[0]?.title ?? "the seminar",
      eventDate: ev[0] ? dateRange(ev[0].startsAt, ev[0].endsAt) : undefined,
      venue: ev[0]?.venue,
      siteUrl: await publicUrl(),
    }).catch(() => false);
  }

  await audit(officer.id, "confirm_payment", "registrations", id);
  revalidatePath("/admin");
  return { ok: true, passcode };
}

export async function confirmManyPayments(ids: string[]) {
  const officer = await requireOfficer();
  if (ids.length === 0) return { error: "Select at least one registration." };

  // Sequential rather than parallel: each one may need a passcode, and two
  // concurrent draws could collide on the uniqueness check.
  let done = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const res = await confirmPayment(id);
    if (res?.ok) done++; else failed.push(id);
  }

  await audit(officer.id, "bulk_confirm_payment", "registrations", ids.join(","), {
    requested: ids.length, confirmed: done,
  });
  revalidatePath("/admin");

  // Reporting the number actually confirmed rather than the number clicked:
  // "confirmed 40" when four silently failed is the kind of thing nobody
  // notices until a participant turns up without a code.
  if (failed.length) {
    return {
      ok: true,
      count: done,
      error: `${done} confirmed, ${failed.length} could not be. Open those rows individually to see why.`,
    };
  }
  return { ok: true, count: done };
}

export async function rejectPayment(id: string, reason: string) {
  const officer = await requireOfficer();
  const clean = reason.trim();
  // Emailed to the participant verbatim, so it cannot be blank.
  if (!clean) return { error: "A rejection reason is required. It is sent to the participant." };

  const [reg] = await db
    .update(registrations)
    .set({ status: "rejected", rejectionReason: clean, confirmedBy: officer.id, confirmedAt: new Date() })
    .where(eq(registrations.id, id))
    .returning({
      email: registrations.email, title: registrations.title,
      firstName: registrations.firstName, surname: registrations.surname,
      eventId: registrations.eventId,
    });

  if (reg) {
    const ev = await db.select({ title: events.title }).from(events).where(eq(events.id, reg.eventId)).limit(1);
    await sendRejectedEmail({
      to: reg.email,
      name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
      eventTitle: ev[0]?.title ?? "the seminar",
      reason: clean,
    }).catch(() => false);
  }

  await audit(officer.id, "reject_payment", "registrations", id, { reason: clean });
  revalidatePath("/admin");
}

export async function adjustAmount(id: string, amountNaira: number) {
  const officer = await requireOfficer();
  if (!Number.isFinite(amountNaira) || amountNaira < 0) return { error: "Enter an amount of zero or more." };

  await db.update(registrations).set({ amountKobo: Math.round(amountNaira * 100) }).where(eq(registrations.id, id));
  await audit(officer.id, "adjust_amount", "registrations", id, { amountNaira });
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------- attendance ---------- */

/** Append-only: a second scan writes a second row rather than overwriting,
 *  so a double scan is visible instead of silent. */
export async function markAttendance(rawPasscode: string, method: "desk" | "qr" = "desk") {
  const officer = await requireOfficer();
  const passcode = normalisePasscode(rawPasscode);
  if (!passcode) return { error: "That passcode is incomplete. It has eight characters, for example EBY4-9K7C." };

  const rows = await db.select().from(registrations).where(eq(registrations.passcode, passcode)).limit(1);
  const reg = rows[0];
  if (!reg) return { error: `No registration found for ${passcode}.` };
  if (reg.status !== "confirmed") {
    return { error: `${reg.firstName} ${reg.surname} — payment is not confirmed yet. Confirm the payment before marking attendance.` };
  }

  const already = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendance)
    .where(eq(attendance.registrationId, reg.id));

  const repeat = (already[0]?.n ?? 0) > 0;

  await db.insert(attendance).values({ registrationId: reg.id, markedBy: officer.id, method });
  await audit(officer.id, "mark_attendance", "registrations", reg.id, { method });

  // Only on the first scan. A second scan at the door after lunch must not
  // send a second email, and the desk is scanning a queue — a failure here
  // cannot be allowed to hold up the person in front of the registrar.
  if (!repeat && reg.passcode) {
    const detail = await db
      .select({
        units: categories.units,
        eventTitle: events.title,
      })
      .from(registrations)
      .innerJoin(categories, eq(categories.id, registrations.categoryId))
      .innerJoin(events, eq(events.id, registrations.eventId))
      .where(eq(registrations.id, reg.id))
      .limit(1);

    if (detail[0]) {
      void sendCertificateReadyEmail({
        to: reg.email,
        name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
        passcode: reg.passcode,
        eventTitle: detail[0].eventTitle,
        units: detail[0].units,
        siteUrl: await publicUrl(),
      }).catch(() => false);
    }
  }

  revalidatePath("/admin/attendance");

  return {
    ok: true,
    name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
    passcode,
    repeat,
  };
}

/* ---------- event settings ---------- */

/**
 * Writes only the fields present in the submitted form.
 *
 * Site settings and event settings are separate pages now, so each posts a
 * subset. Writing every column unconditionally would let the site form null
 * out the event form's values and vice versa.
 */
/** Branch-level settings. Writes only the fields present in the form. */
export async function updateBranchSettings(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change settings." };

  const FIELDS = [
    "branchName", "registeredAddress", "aboutBody", "contactPhones",
    "contactEmail", "supportWhatsapp", "bankName", "accountName", "accountNumber",
  ] as const;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of FIELDS) {
    if (!formData.has(key)) continue;
    patch[key] = String(formData.get(key) ?? "").trim() || null;
  }

  await db.insert(branchSettings).values({ id: 1, ...patch })
    .onConflictDoUpdate({ target: branchSettings.id, set: patch });

  await audit(officer.id, "update_branch_settings", "branch_settings", "1", { fields: Object.keys(patch) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Create or update one event. */
export async function saveEvent(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change events." };

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!title) return { error: "An event needs a title." };
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: "The slug may use lowercase letters, numbers and hyphens only." };

  const startsRaw = String(formData.get("startsAt") ?? "").trim();
  const startsAt = new Date(startsRaw);
  if (Number.isNaN(startsAt.getTime())) return { error: "Enter a valid start date and time." };

  const optionalDate = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const values = {
    slug,
    title,
    theme: String(formData.get("theme") ?? "").trim(),
    eventType: String(formData.get("eventType") ?? "").trim() || null,
    startsAt,
    endsAt: optionalDate("endsAt"),
    registrationDeadline: optionalDate("registrationDeadline"),
    timeLine: String(formData.get("timeLine") ?? "").trim() || null,
    venue: String(formData.get("venue") ?? "").trim(),
    venueAddress: String(formData.get("venueAddress") ?? "").trim(),
    meetingUrl: String(formData.get("meetingUrl") ?? "").trim() || null,
    meetingId: String(formData.get("meetingId") ?? "").trim() || null,
    status: (["draft", "open", "closed", "archived"] as const).includes(
      String(formData.get("status")) as never,
    )
      ? (String(formData.get("status")) as "draft" | "open" | "closed" | "archived")
      : "draft",
    updatedAt: new Date(),
  };

  let eventId = id;
  if (id) {
    await db.update(events).set(values).where(eq(events.id, id));
  } else {
    const [row] = await db.insert(events).values(values).returning({ id: events.id });
    eventId = row?.id ?? "";
  }

  await audit(officer.id, id ? "update_event" : "create_event", "events", eventId, { slug });
  revalidatePath("/", "layout");
  revalidatePath("/admin/events");
  return { ok: true, id: eventId };
}

/** Exactly one event leads the home page. */
export async function featureEvent(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change events." };

  await db.update(events).set({ isFeatured: false }).where(eq(events.isFeatured, true));
  await db.update(events).set({ isFeatured: true }).where(eq(events.id, id));

  await audit(officer.id, "feature_event", "events", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/events");
  return { ok: true };
}

export async function deleteEvent(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can delete events." };

  // Registrations are payment records. An event that has any must be archived,
  // never removed — the rows reference it and the history matters.
  const used = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.eventId, id));
  if ((used[0]?.n ?? 0) > 0) {
    return { error: `That event has ${used[0].n} registration(s). Set its status to archived instead of deleting it.` };
  }

  await db.delete(events).where(eq(events.id, id));
  await audit(officer.id, "delete_event", "events", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/events");
  return { ok: true };
}

/**
 * Files are uploaded browser → Blob before the form is submitted (see
 * components/FileUpload and api/blob-upload), so an action receives a URL,
 * never bytes. This keeps the request well under Vercel's 4.5MB function
 * limit — the limit that made a phone photo of a flyer fail with a 413.
 *
 * The URL still has to be checked: a form field is user input, and accepting
 * an arbitrary one would let someone point the site at an image they host.
 */
function blobUrl(formData: FormData, field: string): string | null {
  const raw = String(formData.get(field) ?? "").trim();
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

/** Blob pathname, kept so the files can be re-uploaded to another store at
 *  handover without rewriting rows. */
function blobPath(url: string): string {
  try { return new URL(url).pathname.replace(/^\//, ""); } catch { return ""; }
}

/* ---------- seminar flyer ---------- */

export async function uploadFlyer(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the flyer." };

  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "No event selected." };

  const alt = String(formData.get("flyerAlt") ?? "").trim() || "Seminar flyer";
  const url = blobUrl(formData, "flyerUrl");

  // Alt text alone is a valid save once a flyer exists.
  if (!url) {
    const existing = await db.select({ u: events.flyerUrl }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!existing[0]?.u) return { error: "Choose an image or PDF to upload." };
    await db.update(events).set({ flyerAlt: alt, updatedAt: new Date() }).where(eq(events.id, eventId));
    revalidatePath("/", "layout");
    revalidatePath(`/admin/events/${eventId}`);
    return { ok: true };
  }

  await db
    .update(events)
    .set({ flyerUrl: url, flyerPath: blobPath(url), flyerAlt: alt, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  await audit(officer.id, "upload_flyer", "events", eventId, { path: blobPath(url) });
  revalidatePath("/", "layout");
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, url };
}

export async function removeFlyer(eventId: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the flyer." };

  const rows = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  const current = rows[0]?.flyerUrl;

  if (current) {
    // Best effort — if the blob is already gone the row should still clear.
    try { await del(current); } catch { /* ignore */ }
  }

  await db
    .update(events)
    .set({ flyerUrl: null, flyerPath: null, flyerAlt: null, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  await audit(officer.id, "remove_flyer", "events", eventId);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

/* ---------- hero slides ---------- */

export async function saveHeroSlide(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the hero." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A slide needs a title." };

  const values: Record<string, unknown> = {
    eyebrow: String(formData.get("eyebrow") ?? "").trim() || null,
    title,
    dateLine: String(formData.get("dateLine") ?? "").trim() || null,
    venueLine: String(formData.get("venueLine") ?? "").trim() || null,
    ctaLabel: String(formData.get("ctaLabel") ?? "").trim() || null,
    ctaHref: String(formData.get("ctaHref") ?? "").trim() || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    published: formData.get("published") === "on",
  };

  if (id) {
    await db.update(heroSlides).set(values).where(eq(heroSlides.id, id));
    await audit(officer.id, "update_hero_slide", "hero_slides", id);
  } else {
    const [row] = await db
      .insert(heroSlides)
      .values(values as typeof heroSlides.$inferInsert)
      .returning({ id: heroSlides.id });
    await audit(officer.id, "create_hero_slide", "hero_slides", row?.id ?? "");
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

export async function deleteHeroSlide(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the hero." };

  await db.delete(heroSlides).where(eq(heroSlides.id, id));
  await audit(officer.id, "delete_hero_slide", "hero_slides", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

/* ---------- branch crest ---------- */

export async function uploadLogo(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the crest." };

  const url = blobUrl(formData, "logoUrl");
  if (!url) return { error: "Choose an image to upload." };

  await db.update(branchSettings)
    .set({ logoUrl: url, logoPath: blobPath(url), updatedAt: new Date() })
    .where(eq(branchSettings.id, 1));

  await audit(officer.id, "upload_logo", "branch_settings", "1", { path: blobPath(url) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- categories ---------- */

export async function saveCategory(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change categories." };

  const id = String(formData.get("id") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!eventId) return { error: "No event selected." };
  if (!name) return { error: "A category needs a name." };

  // The key is derived from the name rather than typed. It only exists so
  // registration links read /register?category=fellows, and asking a branch
  // officer to invent one was exposing plumbing.
  const key =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "category";

  // Order follows the order rows were added, so nobody has to manage numbers.
  const existingCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.eventId, eventId));
  const nextOrder = existingCount[0]?.n ?? 0;

  const values = {
    eventId,
    key,
    name,
    eligibility: String(formData.get("eligibility") ?? "").trim(),
    feeKobo: Math.round(Number(formData.get("fee") ?? 0) * 100),
    units: Number(formData.get("units") ?? 0) || 0,
    requiresMembershipNo: formData.get("requiresMembershipNo") === "on",
    ...(id ? {} : { sortOrder: nextOrder }),
  };

  if (id) {
    await db.update(categories).set(values).where(eq(categories.id, id));
  } else {
    await db.insert(categories).values(values);
  }

  await audit(officer.id, "save_category", "categories", id || key, values);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change categories." };

  // A category with registrations against it must not vanish — the rows
  // reference it, and the fee history matters at reconciliation.
  const used = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.categoryId, id));
  if ((used[0]?.n ?? 0) > 0) {
    return { error: `That category has ${used[0].n} registration(s) against it and cannot be deleted.` };
  }

  await db.delete(categories).where(eq(categories.id, id));
  await audit(officer.id, "delete_category", "categories", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

/* ---------- advert rates ---------- */

export async function saveAdvertRate(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change advert rates." };

  const id = String(formData.get("id") ?? "");
  const placement = String(formData.get("placement") ?? "").trim();
  if (!placement) return { error: "A placement needs a name." };

  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) return { error: "No event selected." };

  const values = {
    eventId,
    placement,
    spec: String(formData.get("spec") ?? "").trim(),
    rateKobo: Math.round(Number(formData.get("rate") ?? 0) * 100),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };

  if (id) {
    await db.update(advertRates).set(values).where(eq(advertRates.id, id));
  } else {
    await db.insert(advertRates).values(values);
  }
  await audit(officer.id, "save_advert_rate", "advert_rates", id || placement, values);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

export async function deleteAdvertRate(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change advert rates." };
  await db.delete(advertRates).where(eq(advertRates.id, id));
  await audit(officer.id, "delete_advert_rate", "advert_rates", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

/* ---------- programme ---------- */

export async function saveProgrammeItem(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the programme." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const timeLabel = String(formData.get("timeLabel") ?? "").trim();
  if (!title || !timeLabel) return { error: "A session needs a time and a title." };

  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) return { error: "No event selected." };

  const values = {
    eventId,
    timeLabel,
    title,
    speaker: String(formData.get("speaker") ?? "").trim() || null,
    isBreak: formData.get("isBreak") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };

  if (id) {
    await db.update(programmeItems).set(values).where(eq(programmeItems.id, id));
  } else {
    await db.insert(programmeItems).values(values);
  }
  await audit(officer.id, "save_programme_item", "programme_items", id || title, values);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

export async function deleteProgrammeItem(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the programme." };
  await db.delete(programmeItems).where(eq(programmeItems.id, id));
  await audit(officer.id, "delete_programme_item", "programme_items", id);
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}

/* ---------- fixed hero background ---------- */

export async function uploadHeroBackground(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the hero." };

  const tone = String(formData.get("heroTextTone") ?? "dark") === "light" ? "light" : "dark";
  const alt = String(formData.get("heroImageAlt") ?? "").trim() || null;

  const patch: Record<string, unknown> = { heroTextTone: tone, heroImageAlt: alt, updatedAt: new Date() };

  // Saving the tone without a new image is a normal edit, not an error.
  const url = blobUrl(formData, "heroImageUrl");
  if (url) { patch.heroImageUrl = url; patch.heroImagePath = blobPath(url); }

  await db.update(branchSettings).set(patch).where(eq(branchSettings.id, 1));
  await audit(officer.id, "update_hero_background", "branch_settings", "1", { tone });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- inner page banner ---------- */

export async function uploadBanner(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the banner." };

  const alt = String(formData.get("bannerImageAlt") ?? "").trim() || null;
  const patch: Record<string, unknown> = { bannerImageAlt: alt, updatedAt: new Date() };

  const url = blobUrl(formData, "bannerImageUrl");
  if (url) { patch.bannerImageUrl = url; patch.bannerImagePath = blobPath(url); }

  await db.update(branchSettings).set(patch).where(eq(branchSettings.id, 1));
  await audit(officer.id, "update_banner", "branch_settings", "1");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeBanner() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the banner." };

  const rows = await db.select().from(branchSettings).where(eq(branchSettings.id, 1)).limit(1);
  const url = rows[0]?.bannerImageUrl;
  if (url) { try { await del(url); } catch { /* row should clear regardless */ } }

  await db.update(branchSettings)
    .set({ bannerImageUrl: null, bannerImagePath: null, bannerImageAlt: null, updatedAt: new Date() })
    .where(eq(branchSettings.id, 1));

  await audit(officer.id, "remove_banner", "branch_settings", "1");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- branding assets and SEO ---------- */

export async function updateBranding(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change branding." };

  const hex = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
  };

  const primary = hex("primaryColor");
  const accent = hex("accentColor");
  if (formData.has("primaryColor") && !primary) return { error: "Enter the primary colour as a six-digit hex value, for example #0B6E4F." };
  if (formData.has("accentColor") && !accent) return { error: "Enter the accent colour as a six-digit hex value, for example #B08A2E." };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (formData.has("metaTitle")) patch.metaTitle = String(formData.get("metaTitle") ?? "").trim() || null;
  if (formData.has("metaDescription")) patch.metaDescription = String(formData.get("metaDescription") ?? "").trim() || null;

  if (formData.has("canonicalUrl")) {
    const raw = String(formData.get("canonicalUrl") ?? "").trim().replace(/\/+$/, "");
    if (!raw) {
      patch.canonicalUrl = null;
    } else {
      // An invalid address here would break every page's <head>, so it is
      // rejected rather than stored and discovered later.
      try {
        const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        if (u.protocol !== "https:") return { error: "The website address must start with https." };
        patch.canonicalUrl = `https://${u.host}`;
      } catch {
        return { error: "Enter the website address as a full domain, for example https://www.niesvebonyi.com.ng" };
      }
    }
  }

  if (formData.has("searchIndexable")) {
    patch.searchIndexable = formData.get("searchIndexable") === "on";
  }

  if (formData.has("googleVerification")) {
    patch.googleVerification = String(formData.get("googleVerification") ?? "").trim() || null;
  }

  if (formData.has("analyticsId")) {
    const raw = String(formData.get("analyticsId") ?? "").trim().toUpperCase();
    if (raw && !/^(G-[A-Z0-9]{4,20}|UA-\d{4,12}-\d{1,4})$/.test(raw)) {
      return { error: "A measurement ID looks like G-XXXXXXXXXX. Copy it from the Google Analytics data stream." };
    }
    patch.analyticsId = raw || null;
  }
  if (primary) patch.primaryColor = primary;
  if (accent) patch.accentColor = accent;

  const favicon = blobUrl(formData, "faviconUrl");
  if (favicon) { patch.faviconUrl = favicon; patch.faviconPath = blobPath(favicon); }

  const og = blobUrl(formData, "ogImageUrl");
  if (og) { patch.ogImageUrl = og; patch.ogImagePath = blobPath(og); }

  await db.update(branchSettings).set(patch).where(eq(branchSettings.id, 1));
  await audit(officer.id, "update_branding", "branch_settings", "1", { fields: Object.keys(patch) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- officers ---------- */

export async function createOfficer(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can add users." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "officer") === "admin" ? "admin" : "officer";

  if (!name) return { error: "Enter the person's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "The password must be at least 10 characters." };

  const existing = await db.select().from(officers).where(eq(officers.email, email)).limit(1);
  if (existing[0]) return { error: "An account already exists with that email address." };

  await db.insert(officers).values({ name, email, passwordHash: hashPassword(password), role });
  await audit(officer.id, "create_officer", "officers", email, { role });
  revalidatePath("/admin/officers");
  return { ok: true };
}

export async function setOfficerActive(id: string, active: boolean) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change users." };
  // Deactivating yourself locks you out of the admin immediately.
  if (id === officer.id) return { error: "You cannot deactivate your own account." };

  await db.update(officers).set({ active }).where(eq(officers.id, id));
  await audit(officer.id, active ? "activate_officer" : "deactivate_officer", "officers", id);
  revalidatePath("/admin/officers");
  return { ok: true };
}

export async function setOfficerRole(id: string, role: "officer" | "admin") {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change users." };
  if (id === officer.id) return { error: "You cannot change your own role." };

  await db.update(officers).set({ role }).where(eq(officers.id, id));
  await audit(officer.id, "set_officer_role", "officers", id, { role });
  revalidatePath("/admin/officers");
  return { ok: true };
}

/** Anyone can change their own password; an admin can reset someone else's. */
export async function changePassword(formData: FormData) {
  const officer = await requireOfficer();
  const targetId = String(formData.get("officerId") ?? "") || officer.id;
  const password = String(formData.get("password") ?? "");

  if (targetId !== officer.id && officer.role !== "admin") {
    return { error: "Only a branch administrator can reset another user's password." };
  }
  if (password.length < 10) return { error: "The password must be at least 10 characters." };

  await db.update(officers).set({ passwordHash: hashPassword(password) }).where(eq(officers.id, targetId));
  await audit(officer.id, "change_password", "officers", targetId);
  revalidatePath("/admin/officers");
  return { ok: true };
}

/** The four categories every NIESV branch seminar uses. Typing them out for
 *  each new event is four rounds of the same form; the fees are then edited
 *  in place from whatever the flyer says. */
export async function addStandardCategories(eventId: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change categories." };
  if (!eventId) return { error: "No event selected." };

  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.eventId, eventId));
  if ((existing[0]?.n ?? 0) > 0) {
    return { error: "This event already has categories. Add or edit them individually." };
  }

  const standard = [
    { key: "fellows", name: "Fellows", eligibility: "Registered Fellows of the Institution", fee: 10000, member: true },
    { key: "members", name: "Members", eligibility: "Registered Members of the Institution", fee: 8000, member: true },
    { key: "probationers", name: "Probationers/Graduates", eligibility: "Probationers and graduate members", fee: 5000, member: true },
    { key: "students", name: "Students", eligibility: "Students of accredited institutions", fee: 2000, member: false },
  ];

  for (const [i, c] of standard.entries()) {
    await db.insert(categories).values({
      eventId,
      key: c.key,
      name: c.name,
      eligibility: c.eligibility,
      feeKobo: c.fee * 100,
      units: 3,
      requiresMembershipNo: c.member,
      sortOrder: i,
    });
  }

  await audit(officer.id, "add_standard_categories", "categories", eventId, { count: standard.length });
  revalidatePath("/", "layout");
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true };
}

/* ---------- pages ---------- */

/**
 * Seeds a row for each system page the first time the Pages section is opened,
 * so the branch has something to edit and the menu has something to order.
 * Idempotent: an existing row is left exactly as the branch left it.
 */
export async function ensureSystemPages() {
  const existing = await db.select({ slug: pages.slug }).from(pages);
  const have = new Set(existing.map((r) => r.slug));

  const missing = SYSTEM_PAGES.filter((p) => !have.has(p.slug));
  if (missing.length === 0) return;

  await db.insert(pages).values(
    missing.map((p) => ({
      slug: p.slug,
      kind: "system",
      title: p.name,
      navLabel: p.navLabel,
      showInNav: p.showInNav,
      navOrder: p.navOrder,
      published: true,
    })),
  );
}

/** Copy, menu placement and search details for one page. */
export async function updatePage(formData: FormData) {
  const officer = await requireOfficer();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "That page no longer exists." };

  const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  const page = rows[0];
  if (!page) return { error: "That page no longer exists." };

  const text = (k: string) => String(formData.get(k) ?? "").trim();

  const title = text("title");
  if (!title) return { error: "Enter a name for this page." };

  const patch: Record<string, unknown> = {
    title,
    navLabel: text("navLabel") || null,
    metaTitle: text("metaTitle") || null,
    metaDescription: text("metaDescription") || null,
    showInNav: formData.get("showInNav") === "on",
    published: formData.get("published") === "on",
    updatedAt: new Date(),
  };

  const order = Number(formData.get("navOrder"));
  if (Number.isFinite(order)) patch.navOrder = Math.max(0, Math.round(order));

  if (page.kind === "system") {
    // Only known slots are stored, and only where they differ from the
    // shipped wording. An empty box means "use the default", which is what
    // lets the branch undo an edit without knowing the original text.
    const sys = systemPage(page.slug);
    const copy: Record<string, string> = {};
    for (const slot of sys?.slots ?? []) {
      const v = text(`copy.${slot.key}`);
      if (v && v !== slot.value) copy[slot.key] = v;
    }
    patch.copy = Object.keys(copy).length ? JSON.stringify(copy) : null;
  } else {
    patch.intro = text("intro") || null;
    patch.body = text("body") || null;
    patch.bannerImageAlt = text("bannerImageAlt") || null;

    const banner = blobUrl(formData, "bannerImageUrl");
    if (banner) { patch.bannerImageUrl = banner; patch.bannerImagePath = blobPath(banner); }
  }

  await db.update(pages).set(patch).where(eq(pages.id, id));
  await audit(officer.id, "update_page", "pages", page.slug, { fields: Object.keys(patch) });

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true };
}

/** A new text page, rendered at /slug. */
export async function createPage(formData: FormData) {
  const officer = await requireOfficer();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Enter a name for the page." };

  const wanted = String(formData.get("slug") ?? "").trim();
  const slug = slugify(wanted || title);
  if (!slug) return { error: "That name does not produce a usable web address. Use letters and numbers." };

  // A custom page cannot sit on a route that already exists in code — the
  // route would win and the page would silently never appear.
  if (RESERVED_SLUGS.has(slug)) {
    return { error: `The address /${slug} is already used by one of the built-in pages. Choose another name.` };
  }

  const clash = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
  if (clash[0]) return { error: `A page already uses the address /${slug}.` };

  const last = await db.select({ n: pages.navOrder }).from(pages).orderBy(desc(pages.navOrder)).limit(1);

  const [made] = await db.insert(pages).values({
    slug,
    kind: "custom",
    title,
    navLabel: title,
    showInNav: formData.get("showInNav") === "on",
    navOrder: (last[0]?.n ?? 0) + 10,
    published: false,   // drafts by default: a half-written page should not appear
  }).returning({ id: pages.id });

  await audit(officer.id, "create_page", "pages", slug);
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true, id: made.id, slug };
}

/**
 * Removes a custom page. A system page is refused: its route lives in code, so
 * deleting the row would not remove the page, it would only strip the branch's
 * wording and drop it out of the menu — with registration or the certificate
 * gate still answering at the same address.
 */
export async function deletePage(id: string) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can delete a page." };

  const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  const page = rows[0];
  if (!page) return { error: "That page no longer exists." };

  if (page.kind === "system") {
    return {
      error: "Built-in pages cannot be deleted, because the registration form, the passcode gates and the certificate live on them. Untick 'Show in menu' to hide this page instead.",
    };
  }

  await db.delete(pages).where(eq(pages.id, id));
  await audit(officer.id, "delete_page", "pages", page.slug);

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true };
}

/** Move one page up or down the menu by swapping order with its neighbour. */
export async function movePage(id: string, direction: "up" | "down") {
  const officer = await requireOfficer();

  const all = await db.select({ id: pages.id, navOrder: pages.navOrder })
    .from(pages).orderBy(asc(pages.navOrder));

  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return { error: "That page no longer exists." };

  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return { ok: true };   // already at the end

  // Orders can collide after hand editing, so rewrite the whole sequence
  // rather than swapping two values that may be equal.
  const order = [...all];
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) {
    await db.update(pages).set({ navOrder: (k + 1) * 10 }).where(eq(pages.id, order[k].id));
  }

  await audit(officer.id, "reorder_pages", "pages", id, { direction });
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true };
}

/** Signatories, wording and artwork for the certificate. */
export async function updateCertificateSettings(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") {
    return { error: "Only a branch administrator can change certificate settings." };
  }

  const text = (k: string) => String(formData.get(k) ?? "").trim();

  const patch: Record<string, unknown> = {
    chairmanName: text("chairmanName") || null,
    chairmanTitle: text("chairmanTitle") || "Chairman",
    secretaryName: text("secretaryName") || null,
    secretaryTitle: text("secretaryTitle") || "Secretary",
    certificateStatement: text("certificateStatement") || null,
    updatedAt: new Date(),
  };

  // The prefix goes into a serial that is printed and cannot be corrected
  // afterwards, so anything that would produce a malformed serial is refused
  // rather than silently stripped.
  const prefixRaw = text("certificateSerialPrefix");
  if (prefixRaw) {
    if (!/^[A-Za-z0-9-]{2,20}$/.test(prefixRaw)) {
      return { error: "The serial prefix can use letters, numbers and hyphens only, up to 20 characters." };
    }
    patch.certificateSerialPrefix = prefixRaw.toUpperCase();
  }

  /* An upload sets the URL; "remove" clears it. Without the clear there was
     no way back from an uploaded artwork to the code-drawn certificate — the
     field only ever accepted a replacement. */
  const image = (field: string, urlCol: string, pathCol: string) => {
    if (formData.get(`${field}__remove`) === "1") {
      patch[urlCol] = null;
      patch[pathCol] = null;
      return;
    }
    const url = blobUrl(formData, field);
    if (url) { patch[urlCol] = url; patch[pathCol] = blobPath(url); }
  };

  image("chairmanSignatureUrl", "chairmanSignatureUrl", "chairmanSignaturePath");
  image("secretarySignatureUrl", "secretarySignatureUrl", "secretarySignaturePath");
  image("certificateBackgroundUrl", "certificateBackgroundUrl", "certificateBackgroundPath");

  /* Only known keys are stored, so a tampered form cannot write arbitrary
     JSON into a column the generator reads. */
  const PARTS = [
    "crest", "branchName", "heading", "border", "certifyLine", "statement",
    "theme", "units", "signatures", "qr", "serial", "verifyLine",
  ] as const;

  if (formData.has("partsSubmitted")) {
    const parts: Record<string, boolean> = {};
    for (const key of PARTS) {
      if (formData.get(`part.${key}`) !== "on") parts[key] = false;
    }
    patch.certificateParts = Object.keys(parts).length ? JSON.stringify(parts) : null;
  }

  if (formData.has("extraLinesJson")) {
    const PLACES = new Set(["underHeading", "underName", "underStatement", "aboveSignatures", "footer"]);
    const SIZES = new Set(["small", "normal", "large"]);
    const STYLES = new Set(["plain", "italic", "bold"]);
    try {
      const raw = JSON.parse(String(formData.get("extraLinesJson") || "[]"));
      const clean = (Array.isArray(raw) ? raw : [])
        .filter((l) => l && typeof l.text === "string" && l.text.trim())
        .slice(0, 5)
        .map((l) => ({
          text: String(l.text).slice(0, 160).trim(),
          place: PLACES.has(l.place) ? l.place : "underStatement",
          size: SIZES.has(l.size) ? l.size : "normal",
          style: STYLES.has(l.style) ? l.style : "plain",
        }));
      patch.certificateExtraLines = clean.length ? JSON.stringify(clean) : null;
    } catch {
      return { error: "The extra lines could not be read. Remove them and add them again." };
    }
  }

  await db.update(branchSettings).set(patch).where(eq(branchSettings.id, 1));
  await audit(officer.id, "update_certificate", "branch_settings", "1", { fields: Object.keys(patch) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Marks attendance from the participant drawer rather than the scanning desk.
 *
 * The desk takes a passcode because that is what it is scanning. Here the
 * officer already has the person open in front of them, so asking them to
 * re-type the code they can see would be silly — and the person may be
 * standing there having lost their card.
 */
export async function markAttendanceById(registrationId: string) {
  const officer = await requireOfficer();

  const rows = await db.select().from(registrations).where(eq(registrations.id, registrationId)).limit(1);
  const reg = rows[0];
  if (!reg) return { error: "That registration no longer exists." };
  if (reg.status !== "confirmed") {
    return { error: "Confirm the payment first. Attendance cannot be recorded against an unconfirmed registration." };
  }
  if (!reg.passcode) {
    return { error: "This registration has no participation code yet." };
  }

  return markAttendance(reg.passcode, "desk");
}

/**
 * Sends the participation code again.
 *
 * The single most common support request at any event is "I never got the
 * email". Without this the officer's only options are reading the code down a
 * phone line or confirming the payment a second time.
 */
export async function resendPasscodeEmail(registrationId: string) {
  const officer = await requireOfficer();

  const rows = await db
    .select({
      email: registrations.email,
      title: registrations.title,
      firstName: registrations.firstName,
      surname: registrations.surname,
      passcode: registrations.passcode,
      status: registrations.status,
      eventTitle: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venue,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.id, registrationId))
    .limit(1);

  const r = rows[0];
  if (!r) return { error: "That registration no longer exists." };
  if (r.status !== "confirmed" || !r.passcode) {
    return { error: "No code has been issued yet. Confirm the payment first." };
  }

  const sent = await sendConfirmedEmail({
    to: r.email,
    name: `${r.title ?? ""} ${r.firstName} ${r.surname}`.trim(),
    passcode: r.passcode,
    eventTitle: r.eventTitle,
    eventDate: dateRange(r.startsAt, r.endsAt),
    venue: r.venue,
    siteUrl: await publicUrl(),
  }).catch(() => false);

  await audit(officer.id, "resend_passcode", "registrations", registrationId);

  // Honest about the outcome. Telling an officer it was sent when email is
  // not configured sends them back to the participant with wrong information.
  if (!sent) {
    return { error: "The email could not be sent. Check that email is configured, and read the code out instead." };
  }
  return { ok: true, email: r.email };
}