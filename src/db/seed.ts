import "./env";
import { eq } from "drizzle-orm";
import { db, branchSettings, events, categories } from "./index";

/**
 * Seeds the branch row and one starter event.
 *
 * ⚠️ These are placeholders. The branch enters real values at /admin/site and
 * /admin/events. Re-running is safe — it skips anything already present.
 */
async function main() {
  console.log("Seeding branch settings...");
  await db
    .insert(branchSettings)
    .values({
      id: 1,
      branchName: "NIESV Ebonyi State Branch",
      bankName: "Zenith Bank PLC",       // TODO confirm
      accountName: "NIESV Ebonyi",        // TODO confirm
      accountNumber: "1012345678",        // ⚠️ placeholder — clearly fake
    })
    .onConflictDoNothing();

  const slug = "mcpd-2026";
  const existing = await db.select().from(events).where(eq(events.slug, slug)).limit(1);

  if (existing[0]) {
    console.log("Starter event already present. Done.");
    process.exit(0);
  }

  console.log("Seeding starter event...");
  const [ev] = await db
    .insert(events)
    .values({
      slug,
      title: "MCPD Seminar 2026",
      theme: "Professionalism and Innovation in Estate Surveying and Valuation Practice",
      eventType: "Hybrid event",
      startsAt: new Date("2026-03-25T09:00:00+01:00"),   // TODO confirm
      endsAt: new Date("2026-03-26T17:00:00+01:00"),      // TODO confirm
      registrationDeadline: new Date("2026-03-20T23:59:59+01:00"),
      timeLine: "09:00 WAT daily",
      venue: "Cititrust Hotel Abakaliki",
      venueAddress: "",
      status: "open",
      isFeatured: true,
    })
    .returning({ id: events.id });

  /* ⚠️ FEE SCHEDULE UNCONFIRMED. Three different schedules have appeared
     across design batches and the reference site. The branch must supply the
     approved figures; these exist only so the page renders. */
  const starter = [
    { key: "fellows", name: "Fellows", eligibility: "Registered Fellows of the Institution", fee: 10000, units: 10, member: true },
    { key: "members", name: "Members", eligibility: "Associate members (ANIVS)", fee: 7500, units: 10, member: true },
    { key: "graduates", name: "Graduates and probationers", eligibility: "Registered probationers and graduates", fee: 5000, units: 10, member: true },
    { key: "niesv-students", name: "NIESV students", eligibility: "Students of accredited institutions", fee: 2000, units: 10, member: true },
    { key: "students", name: "Students and graduates (not registered)", eligibility: "Non-registered surveying students", fee: 3000, units: 5, member: false },
    { key: "non-members", name: "Non-members", eligibility: "General public and other professionals", fee: 15000, units: 5, member: false },
    { key: "corporate", name: "Corporate or organisation", eligibility: "Corporate bodies and firms", fee: 50000, units: 20, member: false },
  ];

  for (const [i, c] of starter.entries()) {
    await db.insert(categories).values({
      eventId: ev.id,
      key: c.key,
      name: c.name,
      eligibility: c.eligibility,
      feeKobo: c.fee * 100,
      units: c.units,
      requiresMembershipNo: c.member,
      sortOrder: i,
    });
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });