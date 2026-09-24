import { and, asc, desc, eq, or } from "drizzle-orm";
import {
  db, branchSettings, events, categories, advertRates, programmeItems,
} from "@/db";

/**
 * Branch-level facts are one row; event-level facts belong to an event.
 *
 * getBranch() is what the header and footer need. getEvent() loads one
 * seminar with its fees, programme and advert rates. The home page features
 * the event flagged isFeatured; the register and certificate pages resolve
 * an event by slug or by passcode.
 */

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

const longDate = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" }).format(d);

/** "25-26 March 2026" rather than dropping the second day. */
export const dateRange = (start: Date, end?: Date | null) => {
  if (!end) return longDate(start);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (!sameMonth) return `${longDate(start)} - ${longDate(end)}`;
  if (start.getUTCDate() === end.getUTCDate()) return longDate(start);
  return `${start.getUTCDate()}-${longDate(end)}`;
};

export async function getBranch() {
  const rows = await db.select().from(branchSettings).limit(1);
  const b = rows[0];

  return {
    branchName: b?.branchName || "NIESV Ebonyi State Branch",
    registeredAddress: b?.registeredAddress || "",
    aboutBody: (b?.aboutBody || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    contactPhones: (b?.contactPhones || "").split(",").map((p) => p.trim()).filter(Boolean),
    contactEmail: b?.contactEmail || "",
    supportWhatsapp: b?.supportWhatsapp || "",
    logoUrl: b?.logoUrl ?? null,
    heroImageUrl: b?.heroImageUrl ?? null,
    heroImageAlt: b?.heroImageAlt ?? null,
    heroTextTone: (b?.heroTextTone === "light" ? "light" : "dark") as "light" | "dark",
    bannerImageUrl: b?.bannerImageUrl ?? null,
    bannerImageAlt: b?.bannerImageAlt ?? null,
    metaTitle: b?.metaTitle || "",
    metaDescription: b?.metaDescription || "",
    faviconUrl: b?.faviconUrl ?? null,
    ogImageUrl: b?.ogImageUrl ?? null,
    primaryColor: b?.primaryColor || "#0B6E4F",
    accentColor: b?.accentColor || "#B08A2E",
    bankName: b?.bankName || "",
    accountName: b?.accountName || "",
    accountNumber: b?.accountNumber || "",
  };
}

/** The event the home page leads with. */
export async function getFeaturedEvent() {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.isFeatured, true), or(eq(events.status, "open"), eq(events.status, "closed"))!))
    .limit(1);
  if (rows[0]) return rows[0];

  // No explicit feature set: fall back to the soonest open event, so the home
  // page is never blank just because nobody ticked a box.
  const fallback = await db
    .select().from(events).where(eq(events.status, "open"))
    .orderBy(asc(events.startsAt)).limit(1);
  return fallback[0] ?? null;
}

export async function getEventBySlug(slug: string) {
  const rows = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Every event a participant could still act on — register, or fetch a
 *  certificate from a past one. */
export async function listPublicEvents() {
  return db
    .select().from(events)
    .where(or(eq(events.status, "open"), eq(events.status, "closed"), eq(events.status, "archived"))!)
    .orderBy(desc(events.startsAt));
}

export async function listOpenEvents() {
  return db
    .select().from(events).where(eq(events.status, "open"))
    .orderBy(asc(events.startsAt));
}

/** One event with everything the public pages render. */
export async function getEventContent(eventId: string) {
  const [cats, adverts, programme] = await Promise.all([
    db.select().from(categories)
      .where(and(eq(categories.eventId, eventId), eq(categories.active, true)))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(advertRates).where(eq(advertRates.eventId, eventId))
      .orderBy(asc(advertRates.sortOrder)),
    db.select().from(programmeItems).where(eq(programmeItems.eventId, eventId))
      .orderBy(asc(programmeItems.sortOrder)),
  ]);

  return {
    categories: cats.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      eligibility: c.eligibility,
      fee: c.feeKobo / 100,
      feeLabel: naira(c.feeKobo),
      units: c.units,
      requiresMembershipNo: c.requiresMembershipNo,
    })),
    advertRates: adverts.map((a) => ({
      placement: a.placement, spec: a.spec, rateLabel: naira(a.rateKobo),
    })),
    programme: programme.map((p) => ({
      time: p.timeLabel, title: p.title, speaker: p.speaker, isBreak: p.isBreak,
    })),
  };
}

/** Shape the public pages consume: an event plus its content, pre-formatted. */
export async function getEventView(event: typeof events.$inferSelect) {
  const content = await getEventContent(event.id);
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    theme: event.theme,
    eventType: event.eventType || "Hybrid event",
    date: dateRange(event.startsAt, event.endsAt),
    time: event.timeLine || "",
    registrationDeadline: event.registrationDeadline
      ? longDate(event.registrationDeadline)
      : "",
    venue: event.venue,
    venueAddress: event.venueAddress,
    meetingUrl: event.meetingUrl,
    meetingId: event.meetingId,
    flyerUrl: event.flyerUrl,
    flyerAlt: event.flyerAlt,
    status: event.status,
    startsAt: event.startsAt,
    ...content,
  };
}

export type BranchView = Awaited<ReturnType<typeof getBranch>>;
export type EventView = Awaited<ReturnType<typeof getEventView>>;

/** "#0B6E4F" -> "11 110 79" for the rgb(var(--x) / <alpha-value>) tokens. */
export function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Relative luminance, for deciding whether white text holds on a colour. */
export function contrastWithWhite(hex: string): number {
  const t = hexToRgbTriplet(hex);
  if (!t) return 0;
  const [r, g, b] = t.split(" ").map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05);
}