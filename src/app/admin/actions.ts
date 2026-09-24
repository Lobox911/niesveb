"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import {
  db, registrations, attendance, auditLog, eventSettings, categories, heroSlides,
  advertRates, programmeItems,
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

export async function updateEventSettings(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change event settings." };

  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const startsAt = new Date(s("startsAt"));
  if (Number.isNaN(startsAt.getTime())) return { error: "Enter a valid start date and time." };

  const deadlineRaw = s("registrationDeadline");
  const values = {
    eventTitle: s("eventTitle"),
    theme: s("theme"),
    startsAt,
    registrationDeadline: deadlineRaw ? new Date(deadlineRaw) : null,
    venue: s("venue"),
    venueAddress: s("venueAddress"),
    bankName: s("bankName"),
    accountName: s("accountName"),
    accountNumber: s("accountNumber"),
    meetingUrl: s("meetingUrl") || null,
    meetingId: s("meetingId") || null,
    supportWhatsapp: s("supportWhatsapp") || null,
    contactEmail: s("contactEmail") || null,
    contactPhones: s("contactPhones") || null,
    branchName: s("branchName") || null,
    registeredAddress: s("registeredAddress") || null,
    timeLine: s("timeLine") || null,
    aboutBody: s("aboutBody") || null,
    updatedAt: new Date(),
  };

  await db.insert(eventSettings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: eventSettings.id, set: values });

  await audit(officer.id, "update_event_settings", "event_settings", "1");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCategoryFee(id: string, feeNaira: number, units: number) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change fees." };
  if (!Number.isFinite(feeNaira) || feeNaira < 0) return { error: "Enter a fee of zero or more." };

  await db.update(categories).set({ feeKobo: Math.round(feeNaira * 100), units }).where(eq(categories.id, id));
  await audit(officer.id, "update_category_fee", "categories", id, { feeNaira, units });

  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
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
  const blob = await put(`flyers/${stamp}-${safe}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const alt = String(formData.get("flyerAlt") ?? "").trim() || "Seminar flyer";

  await db
    .update(eventSettings)
    .set({ flyerUrl: blob.url, flyerPath: blob.pathname, flyerAlt: alt, updatedAt: new Date() })
    .where(eq(eventSettings.id, 1));

  await audit(officer.id, "upload_flyer", "event_settings", "1", { pathname: blob.pathname });
  revalidatePath("/", "layout");
  revalidatePath("/admin/event");
  return { ok: true, url: blob.url };
}

export async function removeFlyer() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change the flyer." };

  const rows = await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1);
  const current = rows[0]?.flyerUrl;

  if (current) {
    // Best effort — if the blob is already gone the row should still clear.
    try { await del(current); } catch { /* ignore */ }
  }

  await db
    .update(eventSettings)
    .set({ flyerUrl: null, flyerPath: null, flyerAlt: null, updatedAt: new Date() })
    .where(eq(eventSettings.id, 1));

  await audit(officer.id, "remove_flyer", "event_settings", "1");
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

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      return { error: "The background must be a JPG, PNG or WebP." };
    }
    if (image.size > 5 * 1024 * 1024) {
      return { error: "That image is larger than 5MB. Export it smaller and try again." };
    }
    const safe = image.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    const blob = await put(`hero/${Date.now()}-${safe}`, image, { access: "public", addRandomSuffix: false });
    values.imageUrl = blob.url;
    values.imagePath = blob.pathname;
    values.imageAlt = String(formData.get("imageAlt") ?? "").trim() || title;
  }

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

  const rows = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1);
  const url = rows[0]?.imageUrl;
  if (url) { try { await del(url); } catch { /* row should clear regardless */ } }

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

  await db.update(eventSettings)
    .set({ logoUrl: blob.url, logoPath: blob.pathname, updatedAt: new Date() })
    .where(eq(eventSettings.id, 1));

  await audit(officer.id, "upload_logo", "event_settings", "1", { pathname: blob.pathname });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- categories ---------- */

export async function saveCategory(formData: FormData) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") return { error: "Only a branch administrator can change categories." };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { error: "A category needs an id and a name." };
  if (!/^[a-z0-9-]+$/.test(id)) return { error: "The id may use lowercase letters, numbers and hyphens only." };

  const values = {
    name,
    eligibility: String(formData.get("eligibility") ?? "").trim(),
    feeKobo: Math.round(Number(formData.get("fee") ?? 0) * 100),
    units: Number(formData.get("units") ?? 0) || 0,
    requiresMembershipNo: formData.get("requiresMembershipNo") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };

  await db.insert(categories).values({ id, ...values })
    .onConflictDoUpdate({ target: categories.id, set: values });

  await audit(officer.id, "save_category", "categories", id, values);
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

  const values = {
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

  const values = {
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