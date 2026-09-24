import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import {
  db, eventSettings, categories, heroSlides, advertRates, programmeItems,
} from "@/db";
import { requireOfficer } from "@/lib/auth";
import EventSettingsForm from "./EventSettingsForm";
import LogoUpload from "./LogoUpload";
import FlyerUpload from "./FlyerUpload";
import HeroSlides from "./HeroSlides";
import HeroBackground from "./HeroBackground";
import { CategoryList, AdvertList, ProgrammeList } from "./Lists";

export const metadata: Metadata = { title: "Event settings" };

export default async function EventPage() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const [settingsRows, cats, slides, adverts, programme] = await Promise.all([
    db.select().from(eventSettings).limit(1),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder)),
    db.select().from(advertRates).orderBy(asc(advertRates.sortOrder)),
    db.select().from(programmeItems).orderBy(asc(programmeItems.sortOrder)),
  ]);
  const s = settingsRows[0];

  const iso = (d: Date | null | undefined) =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Event settings</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        Everything on this page appears on the public site and takes effect
        immediately. Nothing here needs a developer.
      </p>

      <EventSettingsForm
        initial={{
          branchName: s?.branchName ?? "",
          registeredAddress: s?.registeredAddress ?? "",
          eventTitle: s?.eventTitle ?? "",
          theme: s?.theme ?? "",
          startsAt: iso(s?.startsAt),
          timeLine: s?.timeLine ?? "",
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
          contactPhones: s?.contactPhones ?? "",
          aboutBody: s?.aboutBody ?? "",
        }}
      />

      <LogoUpload current={s?.logoUrl ?? null} />

      <CategoryList
        rows={cats.map((c) => ({
          id: c.id, name: c.name, eligibility: c.eligibility,
          fee: c.feeKobo / 100, units: c.units,
          requiresMembershipNo: c.requiresMembershipNo, sortOrder: c.sortOrder,
        }))}
      />

      <AdvertList
        rows={adverts.map((a) => ({
          id: a.id, placement: a.placement, spec: a.spec,
          rate: a.rateKobo / 100, sortOrder: a.sortOrder,
        }))}
      />

      <ProgrammeList
        rows={programme.map((p) => ({
          id: p.id, timeLabel: p.timeLabel, title: p.title,
          speaker: p.speaker ?? "", isBreak: p.isBreak, sortOrder: p.sortOrder,
        }))}
      />

      <HeroBackground
        current={s?.heroImageUrl ?? null}
        alt={s?.heroImageAlt ?? null}
        tone={s?.heroTextTone ?? "dark"}
      />

      <HeroSlides rows={slides} />

      <FlyerUpload current={s?.flyerUrl ?? null} alt={s?.flyerAlt ?? null} />
    </div>
  );
}