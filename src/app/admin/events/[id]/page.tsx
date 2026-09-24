import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, events, categories, advertRates, programmeItems } from "@/db";
import { requireOfficer } from "@/lib/auth";
import SectionNav from "../../SectionNav";
import EventForm from "./EventForm";
import { CategoryList, AdvertList, ProgrammeList } from "../../event/Lists";
import FlyerUpload from "../../event/FlyerUpload";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const { id } = await params;
  const isNew = id === "new";

  const rows = isNew ? [] : await db.select().from(events).where(eq(events.id, id)).limit(1);
  const ev = rows[0];
  if (!isNew && !ev) notFound();

  const [cats, adverts, programme] = isNew
    ? [[], [], []]
    : await Promise.all([
        db.select().from(categories).where(eq(categories.eventId, id)).orderBy(asc(categories.sortOrder)),
        db.select().from(advertRates).where(eq(advertRates.eventId, id)).orderBy(asc(advertRates.sortOrder)),
        db.select().from(programmeItems).where(eq(programmeItems.eventId, id)).orderBy(asc(programmeItems.sortOrder)),
      ]);

  return (
    <div className="p-6 lg:p-10">
      <Link href="/admin/events" className="text-[14px] text-green underline underline-offset-4">
        ← All events
      </Link>
      <h1 className="mt-3 text-[26px] text-ink">{isNew ? "Add an event" : ev!.title}</h1>

      {isNew ? (
        <>
          <p className="mt-1 max-w-prose text-[15px] text-muted">
            Save the event first, then add its fees, programme and flyer.
          </p>
          <EventForm />
        </>
      ) : (
        <>
          <SectionNav
            items={[
              { id: "details", label: "Details" },
              { id: "categories", label: "Categories" },
              { id: "adverts", label: "Advert rates" },
              { id: "programme", label: "Programme" },
              { id: "flyer", label: "Flyer" },
            ]}
          />

          <div id="details" className="scroll-mt-24">
            <EventForm event={ev} />
          </div>

          <div id="categories" className="scroll-mt-24">
            <CategoryList
              eventId={id}
              rows={cats.map((c) => ({
                id: c.id, key: c.key, name: c.name, eligibility: c.eligibility,
                fee: c.feeKobo / 100, units: c.units,
                requiresMembershipNo: c.requiresMembershipNo, sortOrder: c.sortOrder,
              }))}
            />
          </div>

          <div id="adverts" className="scroll-mt-24">
            <AdvertList
              eventId={id}
              rows={adverts.map((a) => ({
                id: a.id, placement: a.placement, spec: a.spec,
                rate: a.rateKobo / 100, sortOrder: a.sortOrder,
              }))}
            />
          </div>

          <div id="programme" className="scroll-mt-24">
            <ProgrammeList
              eventId={id}
              rows={programme.map((p) => ({
                id: p.id, timeLabel: p.timeLabel, title: p.title,
                speaker: p.speaker ?? "", isBreak: p.isBreak, sortOrder: p.sortOrder,
              }))}
            />
          </div>

          <div id="flyer" className="scroll-mt-24">
            <FlyerUpload eventId={id} current={ev!.flyerUrl} alt={ev!.flyerAlt} />
          </div>
        </>
      )}
    </div>
  );
}