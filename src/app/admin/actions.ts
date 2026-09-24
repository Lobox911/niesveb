"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import {
  db, registrations, attendance, auditLog, branchSettings, events, categories,
  heroSlides, advertRates, programmeItems,
} from "@/db";
import { authenticate, createSession, destroySession, requireOfficer } from "@/lib/auth";
import { normalisePasscode } from "@/lib/passcode";
import { put, del } from "@vercel/blob";

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

export async function confirmPayment(id: string) {
  const officer = await requireOfficer();
  await db
    .update(registrations)
    .set({ status: "confirmed", confirmedBy: officer.id, confirmedAt: new Date(), rejectionReason: null })
    .where(eq(registrations.id, id));
  await audit(officer.id, "confirm_payment", "registrations", id);
  revalidatePath("/admin");
}

export async function confirmManyPayments(ids: string[]) {
  const officer = await requireOfficer();
  if (ids.length === 0) return { error: "Select at least one registration." };

  for (const id of ids) {
    await db
      .update(registrations)
      .set({ status: "confirmed", confirmedBy: officer.id, confirmedAt: new Date(), rejectionReason: null })
      .where(eq(registrations.id, id));
  }
  await audit(officer.id, "bulk_confirm_payment", "registrations", ids.join(","), { count: ids.length });
  revalidatePath("/admin");
  return { ok: true, count: ids.length };
}

export async function rejectPayment(id: string, reason: string) {
  const officer = await requireOfficer();
  const clean = reason.trim();
  // Emailed to the participant verbatim, so it cannot be blank.
  if (!clean) return { error: "A rejection reason is required. It is sent to the participant." };

  await db
    .update(registrations)
    .set({ status: "rejected", rejectionReason: clean, confirmedBy: officer.id, confirmedAt: new Date() })
    .where(eq(registrations.id, id));
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

  await db.insert(attendance).values({ registrationId: reg.id, markedBy: officer.id, method });
  await audit(officer.id, "mark_attendance", "registrations", reg.id, { method });
  revalidatePath("/admin/attendance");

  return {
    ok: true,
    name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
    passcode,
    repeat: (already[0]?.n ?? 0) > 0,
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

/* ---------- seminar flyer ---------- */

export async function uploadFlyer(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the flyer." };

  const file = formData.get("flyer");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image or PDF to upload." };

  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!ALLOWED.includes(file.type)) {
    return { error: "The flyer must be a JPG, PNG, WebP or PDF." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "That file is larger than 8MB. Export it at a smaller size and try again." };
  }

  const stamp = Date.now();
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();

  // addRandomSuffix keeps old uploads reachable; the row points at the newest.
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "No event selected." };

  const blob = await put(`flyers/${stamp}-${safe}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const alt = String(formData.get("flyerAlt") ?? "").trim() || "Seminar flyer";

  await db
    .update(events)
    .set({ flyerUrl: blob.url, flyerPath: blob.pathname, flyerAlt: alt, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  await audit(officer.id, "upload_flyer", "events", eventId, { pathname: blob.pathname });
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true, url: blob.url };
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

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!["image/png", "image/webp", "image/svg+xml", "image/jpeg"].includes(file.type)) {
    return { error: "The crest must be a PNG, WebP, SVG or JPG." };
  }
  if (file.size > 2 * 1024 * 1024) return { error: "That file is larger than 2MB." };

  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  const blob = await put(`brand/${Date.now()}-${safe}`, file, { access: "public", addRandomSuffix: false });

  await db.update(branchSettings)
    .set({ logoUrl: blob.url, logoPath: blob.pathname, updatedAt: new Date() })
    .where(eq(branchSettings.id, 1));

  await audit(officer.id, "upload_logo", "branch_settings", "1", { pathname: blob.pathname });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- categories ---------- */

export async function saveCategory(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change categories." };

  const id = String(formData.get("id") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!eventId) return { error: "No event selected." };
  if (!key || !name) return { error: "A category needs a key and a name." };
  if (!/^[a-z0-9-]+$/.test(key)) return { error: "The key may use lowercase letters, numbers and hyphens only." };

  const values = {
    eventId,
    key,
    name,
    eligibility: String(formData.get("eligibility") ?? "").trim(),
    feeKobo: Math.round(Number(formData.get("fee") ?? 0) * 100),
    units: Number(formData.get("units") ?? 0) || 0,
    requiresMembershipNo: formData.get("requiresMembershipNo") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
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

  const file = formData.get("heroImage");
  const patch: Record<string, unknown> = { heroTextTone: tone, heroImageAlt: alt, updatedAt: new Date() };

  if (file instanceof File && file.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { error: "The background must be a JPG, PNG or WebP." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "That image is larger than 5MB. Export it smaller and try again." };
    }
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    const blob = await put(`hero/${Date.now()}-${safe}`, file, { access: "public", addRandomSuffix: false });
    patch.heroImageUrl = blob.url;
    patch.heroImagePath = blob.pathname;
  }

  await db.update(branchSettings).set(patch).where(eq(branchSettings.id, 1));
  await audit(officer.id, "update_hero_background", "branch_settings", "1", { tone });
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true };
}