import {
  pgTable, pgEnum, text, integer, timestamp, uuid, boolean, index, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Option A: a passcode is issued at registration time. It works immediately
 * for the photo card. The certificate is gated on payment_status = 'confirmed'
 * AND an attendance row existing. If the branch later wants passcodes withheld
 * until confirmation, move the code generation into the confirm action — the
 * schema does not change.
 */

export const paymentStatus = pgEnum("payment_status", [
  "pending",   // registered, bank payment not yet checked by an officer
  "confirmed", // officer matched the teller slip
  "rejected",  // officer rejected; reason is mandatory and emailed verbatim
]);

export const attendanceMode = pgEnum("attendance_mode", ["physical", "virtual"]);
export const officerRole = pgEnum("officer_role", ["officer", "admin"]);

/** Categories live in the DB rather than lib/event.ts so the branch can edit
 *  fees from the admin config form without a deploy. Seed from event.ts. */
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),            // 'fellows', 'members', ...
  name: text("name").notNull(),
  eligibility: text("eligibility").notNull().default(""),
  feeKobo: integer("fee_kobo").notNull(), // money in kobo — never floats
  units: integer("units").notNull().default(0),
  requiresMembershipNo: boolean("requires_membership_no").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // The passcode. Issued at insert. Format EBY4-9K7C.
    passcode: text("passcode").notNull(),

    // Identity
    title: text("title"),
    surname: text("surname").notNull(),
    firstName: text("first_name").notNull(),
    otherNames: text("other_names"),
    membershipNo: text("membership_no"),   // NIESV number, uppercased
    esvarbonNo: text("esvarbon_no"),

    // Contact
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    firm: text("firm"),
    town: text("town"),

    // Participation
    categoryId: text("category_id").notNull().references(() => categories.id),
    mode: attendanceMode("mode").notNull(),
    consentPublish: boolean("consent_publish").notNull().default(false),

    // Payment evidence, as supplied by the participant
    amountKobo: integer("amount_kobo").notNull(),
    txnRef: text("txn_ref").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    proofUrl: text("proof_url"),           // blob storage key

    // Officer verdict
    status: paymentStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    confirmedBy: uuid("confirmed_by").references(() => officers.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    photoUrl: text("photo_url"),           // portrait for the photo card

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("registrations_passcode_idx").on(t.passcode),
    // A membership number registers once. Enforced in the DB rather than in
    // app code, so the duplicate panel on the form is a real constraint.
    uniqueIndex("registrations_membership_idx").on(t.membershipNo),
    index("registrations_email_idx").on(t.email),
    index("registrations_status_idx").on(t.status),
    index("registrations_txn_idx").on(t.txnRef),
  ],
);

/** Append-only. One row per scan or desk lookup — never updated, so a double
 *  scan is visible rather than silently overwriting the first. */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id),
    markedAt: timestamp("marked_at", { withTimezone: true }).defaultNow().notNull(),
    markedBy: uuid("marked_by").references(() => officers.id),
    method: text("method").notNull().default("desk"), // 'desk' | 'qr' | 'virtual'
  },
  (t) => [index("attendance_registration_idx").on(t.registrationId)],
);

/** Serial is public and appears on the certificate and in the QR target. */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id),
    serial: text("serial").notNull(),      // e.g. NIESV-EB-2026-0041
    unitsAwarded: integer("units_awarded").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("certificates_serial_idx").on(t.serial),
    uniqueIndex("certificates_registration_idx").on(t.registrationId),
  ],
);

export const officers = pgTable(
  "officers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: officerRole("role").notNull().default("officer"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("officers_email_idx").on(t.email)],
);

/** Every confirm, reject, amount adjustment and attendance mark writes a row.
 *  This is money handling — who did what, when, must be answerable. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    officerId: uuid("officer_id").references(() => officers.id),
    action: text("action").notNull(),        // 'confirm_payment', 'reject_payment', ...
    targetTable: text("target_table").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail"),                  // JSON: before/after
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_target_idx").on(t.targetTable, t.targetId)],
);

/** Single-row table for the event itself, so the admin config form can edit
 *  theme, date, venue and bank details without a deploy. */
export const eventSettings = pgTable("event_settings", {
  id: integer("id").primaryKey().default(1),
  eventTitle: text("event_title").notNull(),
  theme: text("theme").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
  venue: text("venue").notNull(),
  venueAddress: text("venue_address").notNull().default(""),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  meetingUrl: text("meeting_url"),
  meetingId: text("meeting_id"),
  supportWhatsapp: text("support_whatsapp"),
  contactPhones: text("contact_phones"),        // comma separated
  branchName: text("branch_name"),
  registeredAddress: text("registered_address"),
  timeLine: text("time_line"),                  // "09:00 WAT daily"
  aboutBody: text("about_body"),                // paragraphs, blank line separated

  /* Branch crest, stored in Vercel Blob. Replaces the "EB" placeholder. */
  logoUrl: text("logo_url"),
  logoPath: text("logo_path"),

  /* One fixed hero background for every slide. Vetted once by the branch,
     which is what makes dark text and a clean, un-dimmed photograph safe —
     per-slide uploads were a gamble on every new image. */
  heroImageUrl: text("hero_image_url"),
  heroImagePath: text("hero_image_path"),
  heroImageAlt: text("hero_image_alt"),
  /* 'dark' text on a pale photo, 'light' text with a scrim on a dark one.
     A setting rather than a guess, because only the branch can see the
     image they chose. */
  heroTextTone: text("hero_text_tone").notNull().default("dark"),

  /* Seminar flyer, stored in Vercel Blob.
     flyerUrl is what the page renders. flyerPath is the blob pathname,
     kept so the files can be re-uploaded to a different store at handover
     without rewriting rows — blob files cannot be transferred between
     accounts, only re-uploaded. */
  flyerUrl: text("flyer_url"),
  flyerPath: text("flyer_path"),
  flyerAlt: text("flyer_alt"),
  contactEmail: text("contact_email"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});



export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
export type Category = typeof categories.$inferSelect;

/** Hero slides — one per upcoming event. The home hero renders these as a
 *  slider; with none published it falls back to the static theme hero, so
 *  the page never depends on a slide existing. */
export const heroSlides = pgTable(
  "hero_slides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eyebrow: text("eyebrow"),              // "MCPD Seminar 2026 / Hybrid"
    title: text("title").notNull(),
    dateLine: text("date_line"),           // free text: "13th August, 2026"
    venueLine: text("venue_line"),
    ctaLabel: text("cta_label"),
    ctaHref: text("cta_href"),
    imageUrl: text("image_url"),           // Vercel Blob
    imagePath: text("image_path"),         // pathname, for store migration
    imageAlt: text("image_alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("hero_slides_published_idx").on(t.published, t.sortOrder)],
);

export type HeroSlide = typeof heroSlides.$inferSelect;

/** Brochure advert placements. A table rather than columns so the branch can
 *  add and remove placements without a schema change — the reference site
 *  lists eight, ours listed two. */
export const advertRates = pgTable("advert_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  placement: text("placement").notNull(),
  spec: text("spec").notNull().default(""),
  rateKobo: integer("rate_kobo").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Programme entries for the running order. */
export const programmeItems = pgTable("programme_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  timeLabel: text("time_label").notNull(),
  title: text("title").notNull(),
  speaker: text("speaker"),
  isBreak: boolean("is_break").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type AdvertRate = typeof advertRates.$inferSelect;
export type ProgrammeItem = typeof programmeItems.$inferSelect;