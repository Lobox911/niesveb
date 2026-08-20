/**
 * Single source of truth for all event content.
 * The footer, home page, category selection, programme and admin config
 * form all read from here. The branch runs 2027 by editing this file.
 *
 * ⚠️  EVERY VALUE MARKED `TODO` IS UNCONFIRMED PLACEHOLDER DATA FROM THE
 *     STITCH EXPORT. Do not deploy until the branch has confirmed them.
 */

export const event = {
  // TODO — confirm with branch
  branch: "NIESV Ebonyi State Branch",
  eventTitle: "MCPD Seminar 2026",
  theme:
    "Professionalism and Innovation in Estate Surveying and Valuation Practice",
  date: "25-26 March 2026",
  time: "09:00 WAT daily",
  registrationDeadline: "20 March 2026",
  venue: "Cititrust Hotel Abakaliki", // TODO — confirm full name
  venueAddress: "", // TODO — required for the Event JSON-LD and the map

  // TODO — CRITICAL. The account number is the single most-copied value on
  // the site. Confirm digit by digit with the branch treasurer before launch.
  bankName: "Zenith Bank PLC",
  accountName: "NIESV Ebonyi",
  accountNumber: "1012345678", // ⚠️ placeholder — clearly fake

  contactPhones: [] as string[], // TODO — required; do not ship an empty footer
  email: "", // TODO
  supportWhatsApp: "", // TODO — the float button needs a real number
  brochureUrl: "",

  /**
   * ⚠️ FEE SCHEDULE UNRESOLVED.
   *
   * Two incompatible schedules appeared across the export batches:
   *
   *   Category            Batch 1     Batch 3 (home_expanded)
   *   Fellows             ₦10,000     ₦25,000
   *   Members/Associates   ₦7,500     ₦20,000
   *   Graduates/Probats    ₦5,000     ₦15,000
   *   Students             ₦2,000      ₦5,000
   *   Non-members         ₦15,000     ₦30,000
   *   Corporate           ₦50,000     absent
   *   Virtual (all cats)   absent     ₦15,000
   *
   * Batch 3 also drops from seven categories to six and introduces a flat
   * virtual rate cutting across categories — that is a different PRICING
   * MODEL, not a different number. Settle this with the branch first:
   *   1. The approved amount per category
   *   2. Six categories or seven
   *   3. Is virtual attendance priced separately, or per category?
   *
   * The values below are batch 1 and are almost certainly wrong.
   */
  categories: [
    { id: "fellows", name: "Fellows", eligibility: "Registered Fellows of the Institution", fee: 10000, units: 10 },
    { id: "members", name: "Members", eligibility: "Associate members (ANIVS)", fee: 7500, units: 10 },
    { id: "graduates", name: "Graduates and probationers", eligibility: "Registered probationers and graduates", fee: 5000, units: 10 },
    { id: "niesv-students", name: "NIESV students", eligibility: "Students of accredited institutions", fee: 2000, units: 10 },
    { id: "students", name: "Students and graduates (not registered)", eligibility: "Non-registered surveying students", fee: 3000, units: 5 },
    { id: "non-members", name: "Non-members", eligibility: "General public and other professionals", fee: 15000, units: 5 },
    { id: "corporate", name: "Corporate or organisation", eligibility: "Corporate bodies and firms", fee: 50000, units: 20 },
  ],

  advertRates: [
    { placement: "Full page (inner)", spec: "", rate: 60000 }, // TODO
    { placement: "Half page", spec: "", rate: 30000 },          // TODO
  ],
  advertDeadline: "", // TODO
  advertEmail: "",    // TODO

  programme: [] as { time: string; title: string; speaker?: string }[], // TODO

  exco: [] as { name: string; office: string; bio?: string }[], // TODO — for /about
} as const;

export const currentYear = new Date().getFullYear();

export const formatNaira = (n: number) =>
  `₦${n.toLocaleString("en-NG")}`;
