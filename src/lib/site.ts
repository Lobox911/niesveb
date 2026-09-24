import { asc } from "drizzle-orm";
import { db, eventSettings, categories, advertRates, programmeItems } from "@/db";
import { event as fallback } from "@/lib/event";

/**
 * Single loader for everything the public site displays.
 *
 * The admin writes to the database; lib/event.ts is only a fallback for
 * whatever the branch has not filled in yet. Before this existed the admin
 * edited the database while the public pages rendered from lib/event.ts, so
 * saving a fee or the account number changed nothing anyone could see.
 *
 * Every page that shows event content should use this and nothing else.
 */

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

const longDate = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" }).format(d);

/** Renders a multi-day event as "25-26 March 2026" rather than dropping the
 *  second day, which made the hero and the at-a-glance strip disagree. */
const dateRange = (start: Date, end?: Date | null) => {
  if (!end) return longDate(start);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (!sameMonth) return `${longDate(start)} - ${longDate(end)}`;
  if (start.getUTCDate() === end.getUTCDate()) return longDate(start);
  return `${start.getUTCDate()}-${longDate(end)}`;
};

export async function getSiteData() {
  const [settingsRows, cats, adverts, programme] = await Promise.all([
    db.select().from(eventSettings).limit(1),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(advertRates).orderBy(asc(advertRates.sortOrder)),
    db.select().from(programmeItems).orderBy(asc(programmeItems.sortOrder)),
  ]);

  const s = settingsRows[0];

  return {
    branch: s?.branchName || fallback.branch,
    eventTitle: s?.eventTitle || fallback.eventTitle,
    theme: s?.theme || fallback.theme,
    date: s?.startsAt ? dateRange(s.startsAt, s.endsAt) : fallback.date,
    time: s?.timeLine || fallback.time,
    registrationDeadline: s?.registrationDeadline
      ? longDate(s.registrationDeadline)
      : fallback.registrationDeadline,
    venue: s?.venue || fallback.venue,
    venueAddress: s?.venueAddress || fallback.venueAddress,
    registeredAddress: s?.registeredAddress || "",

    bankName: s?.bankName || fallback.bankName,
    accountName: s?.accountName || fallback.accountName,
    accountNumber: s?.accountNumber || fallback.accountNumber,

    // Stored comma separated; the form is one field, the footer needs a list.
    contactPhones: (s?.contactPhones || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    email: s?.contactEmail || fallback.email,
    supportWhatsapp: s?.supportWhatsapp || fallback.supportWhatsApp,

    aboutBody: (s?.aboutBody || "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),

    logoUrl: s?.logoUrl ?? null,
    heroImageUrl: s?.heroImageUrl ?? null,
    heroImageAlt: s?.heroImageAlt ?? null,
    heroTextTone: (s?.heroTextTone === "light" ? "light" : "dark") as "light" | "dark",
    eventType: s?.eventType || "Hybrid event",
    flyerUrl: s?.flyerUrl ?? null,
    flyerAlt: s?.flyerAlt ?? null,

    // Categories come from the database only — the admin fee editor is the
    // single source, so there is no fallback to drift out of sync with it.
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      eligibility: c.eligibility,
      fee: c.feeKobo / 100,
      feeLabel: naira(c.feeKobo),
      units: c.units,
    })),

    advertRates: adverts.map((a) => ({
      placement: a.placement,
      spec: a.spec,
      rateLabel: naira(a.rateKobo),
    })),

    programme: programme.map((p) => ({
      time: p.timeLabel,
      title: p.title,
      speaker: p.speaker,
      isBreak: p.isBreak,
    })),
  };
}

export type SiteData = Awaited<ReturnType<typeof getSiteData>>;