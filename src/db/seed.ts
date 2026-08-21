import "./env";
import { db, categories, eventSettings } from "./index";
import { event } from "../lib/event";
import { db, categories, eventSettings } from "./index";
import { event } from "../lib/event";

/**
 * Seeds categories and event settings from lib/event.ts.
 * ⚠️ Those values are UNCONFIRMED placeholders. Re-run after the branch
 * supplies the approved fee schedule — it is idempotent.
 */
async function main() {
  console.log("Seeding categories...");
  for (const [i, c] of event.categories.entries()) {
    await db
      .insert(categories)
      .values({
        id: c.id,
        name: c.name,
        eligibility: c.eligibility,
        feeKobo: c.fee * 100,
        units: c.units,
        requiresMembershipNo: ["fellows", "members", "graduates", "niesv-students"].includes(c.id),
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: { name: c.name, feeKobo: c.fee * 100, units: c.units, sortOrder: i },
      });
  }

  console.log("Seeding event settings...");
  await db
    .insert(eventSettings)
    .values({
      id: 1,
      eventTitle: event.eventTitle,
      theme: event.theme,
      startsAt: new Date("2026-03-25T09:00:00+01:00"), // TODO: confirm
      registrationDeadline: new Date("2026-03-20T23:59:59+01:00"), // TODO: confirm
      venue: event.venue,
      venueAddress: event.venueAddress,
      bankName: event.bankName,
      accountName: event.accountName,
      accountNumber: event.accountNumber, // ⚠️ placeholder
    })
    .onConflictDoNothing();

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
