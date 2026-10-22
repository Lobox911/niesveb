/**
 * Writes the branch's certificate settings into the existing row.
 *
 * Run once:  npx tsx scripts/seed-certificate.mts
 *
 * A script rather than schema defaults, because a column default only applies
 * to rows created after it — and branch_settings has held exactly one row
 * since the portal was set up. Changing the default there would have looked
 * like it worked and changed nothing.
 *
 * Safe to run twice: it sets the same values again. It does not touch the
 * crest, artwork or signature images, which live in the blob store.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const { db, branchSettings } = await import("../src/db/index.js");
const { eq } = await import("drizzle-orm");

const STATEMENT =
  "participated in the Mandatory Continuing Professional Development (MCPD) Seminar " +
  "approved by the Estate Surveyors and Valuers Registration Board of Nigeria";

/* Everything the branch approved, in one place. Edit here and re-run if any
   of it changes before the seminar. */
const VALUES = {
  branchName: "Ebonyi State Branch",
  institutionName: "Nigerian Institution of Estate Surveyors and Valuers",
  certificateHeading: "Certificate of Participation",
  certificateStatement: STATEMENT,

  chairmanName: "Esv. Chizoba Nnaemeka Ugwu",
  chairmanTitle: "Chairman, Ebonyi State Branch",
  chairmanPostNominals: "MNIVS, RSV",

  // The column is still called "secretary" from an earlier design. The
  // right-hand signatory on an MCPD certificate is the national MCPD chairman.
  secretaryName: "Esv. (Sir) Charles O. Ebiai",
  secretaryTitle: "National MCPD Chairman",
  secretaryPostNominals: "FNIVS, RSV, MIRWA",

  certificatePrimary: "#001E4C",
  certificateAccent: "#EA0411",
  certificateWatermark: 5,

  /* The branch asked for the credit-points line off. Only false values are
     stored — a missing key means the part is printed. */
  certificateParts: JSON.stringify({ units: false }),

  updatedAt: new Date(),
};

const rows = await db.select({ id: branchSettings.id }).from(branchSettings).limit(1);

if (!rows[0]) {
  console.error(
    "No branch_settings row found. Open Site settings in the dashboard and save once, then run this again.",
  );
  process.exit(1);
}

await db.update(branchSettings).set(VALUES).where(eq(branchSettings.id, rows[0].id));

console.log("Certificate settings written:\n");
for (const [k, v] of Object.entries(VALUES)) {
  if (k === "updatedAt") continue;
  console.log(`  ${k.padEnd(24)} ${String(v).slice(0, 70)}`);
}
console.log("\nThe ESVARBON crest prints from the bundled copy unless one is uploaded.");
console.log("Signature images still need uploading in Site settings → Certificate.");
