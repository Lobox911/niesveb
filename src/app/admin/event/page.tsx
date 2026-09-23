import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, eventSettings, categories, heroSlides } from "@/db";
import { requireOfficer } from "@/lib/auth";
import EventSettingsForm from "./EventSettingsForm";
import FeeTable from "./FeeTable";
import FlyerUpload from "./FlyerUpload";
import HeroSlides from "./HeroSlides";

export const metadata: Metadata = { title: "Event settings" };

export default async function EventPage() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const [settingsRows, cats, slides] = await Promise.all([
    db.select().from(eventSettings).limit(1),
    db.select().from(categories).orderBy(categories.sortOrder),
    db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder)),
  ]);
  const s = settingsRows[0];

  const iso = (d: Date | null | undefined) =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Event settings</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        These values appear on the public site. Changes take effect immediately,
        so the branch can run next year&rsquo;s seminar without a developer.
      </p>

      <EventSettingsForm
        initial={{
          eventTitle: s?.eventTitle ?? "",
          theme: s?.theme ?? "",
          startsAt: iso(s?.startsAt),
          registrationDeadline: iso(s?.registrationDeadline),
          venue: s?.venue ?? "",
          venueAddress: s?.venueAddress ?? "",
          bankName: s?.bankName ?? "",
          accountName: s?.accountName ?? "",
          accountNumber: s?.accountNumber ?? "",
          meetingUrl: s?.meetingUrl ?? "",
          meetingId: s?.meetingId ?? "",
          supportWhatsapp: s?.supportWhatsapp ?? "",
          contactEmail: s?.contactEmail ?? "",
        }}
      />

      <HeroSlides rows={slides} />

      <FlyerUpload current={s?.flyerUrl ?? null} alt={s?.flyerAlt ?? null} />

      <FeeTable
        rows={cats.map((c) => ({
          id: c.id, name: c.name, fee: c.feeKobo / 100, units: c.units,
        }))}
      />
    </div>
  );
}