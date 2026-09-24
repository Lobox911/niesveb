import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import {
  db, eventSettings, categories, heroSlides, advertRates, programmeItems,
} from "@/db";
import { requireOfficer } from "@/lib/auth";
import SettingsForm from "../SettingsForm";
import SectionNav from "../SectionNav";
import FlyerUpload from "./FlyerUpload";
import HeroSlides from "./HeroSlides";
import { CategoryList, AdvertList, ProgrammeList } from "./Lists";

export const metadata: Metadata = { title: "Event settings" };

/**
 * Everything that changes from one seminar to the next. Branch identity and
 * contact details live on the site settings page instead.
 */
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
        This year&rsquo;s seminar. Everything here appears on the public site
        and takes effect immediately.
      </p>

      <SectionNav
        items={[
          { id: "details", label: "Seminar details" },
          { id: "categories", label: "Categories" },
          { id: "adverts", label: "Advert rates" },
          { id: "programme", label: "Programme" },
          { id: "slides", label: "Upcoming events" },
          { id: "flyer", label: "Flyer" },
        ]}
      />

      <div id="details" className="scroll-mt-24">
      <SettingsForm
        submitLabel="Save event settings"
        initial={{
          eventTitle: s?.eventTitle ?? "",
          theme: s?.theme ?? "",
          eventType: s?.eventType ?? "",
          startsAt: iso(s?.startsAt),
          endsAt: iso(s?.endsAt),
          timeLine: s?.timeLine ?? "",
          registrationDeadline: iso(s?.registrationDeadline),
          venue: s?.venue ?? "",
          venueAddress: s?.venueAddress ?? "",
          bankName: s?.bankName ?? "",
          accountName: s?.accountName ?? "",
          accountNumber: s?.accountNumber ?? "",
          meetingUrl: s?.meetingUrl ?? "",
          meetingId: s?.meetingId ?? "",
        }}
        groups={[
          {
            legend: "The seminar",
            fields: [
              { name: "eventTitle", label: "Event title" },
              { name: "theme", label: "Theme", help: "The headline on the home page." },
              { name: "eventType", label: "Event type", help: "Shown above the hero title, for example: Hybrid event." },
              { name: "startsAt", label: "Starts at", type: "datetime-local" },
              { name: "endsAt", label: "Ends at", type: "datetime-local", help: "For a two-day seminar. Leave blank for a single day." },
              { name: "timeLine", label: "Time, as written", help: "For example: 09:00 WAT daily." },
              { name: "registrationDeadline", label: "Registration deadline", type: "datetime-local" },
              { name: "venue", label: "Venue" },
              { name: "venueAddress", label: "Venue address", help: "Used for search listings and maps." },
            ],
          },
          {
            legend: "Bank details",
            fields: [
              { name: "bankName", label: "Bank name" },
              { name: "accountName", label: "Account name" },
              { name: "accountNumber", label: "Account number", mono: true, help: "Check this digit by digit. Participants copy it straight into their banking app." },
            ],
          },
          {
            legend: "Virtual session",
            fields: [
              { name: "meetingUrl", label: "Meeting link", type: "url" },
              { name: "meetingId", label: "Meeting ID" },
            ],
          },
        ]}
      />
      </div>

      <div id="categories" className="scroll-mt-24">
      <CategoryList
        rows={cats.map((c) => ({
          id: c.id, name: c.name, eligibility: c.eligibility,
          fee: c.feeKobo / 100, units: c.units,
          requiresMembershipNo: c.requiresMembershipNo, sortOrder: c.sortOrder,
        }))}
      />
      </div>

      <div id="adverts" className="scroll-mt-24">
      <AdvertList
        rows={adverts.map((a) => ({
          id: a.id, placement: a.placement, spec: a.spec,
          rate: a.rateKobo / 100, sortOrder: a.sortOrder,
        }))}
      />
      </div>

      <div id="programme" className="scroll-mt-24">
      <ProgrammeList
        rows={programme.map((p) => ({
          id: p.id, timeLabel: p.timeLabel, title: p.title,
          speaker: p.speaker ?? "", isBreak: p.isBreak, sortOrder: p.sortOrder,
        }))}
      />
      </div>

      <div id="slides" className="scroll-mt-24">
        <HeroSlides rows={slides} />
      </div>

      <div id="flyer" className="scroll-mt-24">
        <FlyerUpload current={s?.flyerUrl ?? null} alt={s?.flyerAlt ?? null} />
      </div>
    </div>
  );
}