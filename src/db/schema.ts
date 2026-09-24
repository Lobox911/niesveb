import {
  pgTable, pgEnum, text, integer, timestamp, uuid, boolean, index, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Two tiers.
 *
 * branch_settings is a single row: who the branch is, how to reach them, the
 * crest, the hero backdrop, and the bank account — the account is shared
 * across every event, so it belongs here and not on the event.
 *
 * events is plural. Each seminar carries its own title, theme, dates, venue,
 * fees, programme, advert rates and flyer. Registrations belong to an event,
 * which is what lets someone who attended 2026 register again for 2027.
 */

export const paymentStatus = pgEnum("payment_status", ["pending", "confirmed", "rejected"]);
export const attendanceMode = pgEnum("attendance_mode", ["physical", "virtual"]);
export const officerRole = pgEnum("officer_role", ["officer", "admin"]);
export const eventStatus = pgEnum("event_status", [
  "draft",     // not on the public site at all
  "open",      // accepting registrations
  "closed",    // registration shut, certificates still reachable
  "archived",  // past; reachable only for certificate retrieval
]);

/* ---------- branch (one row) ---------- */

export const branchSettings = pgTable("branch_settings", {
  id: integer("id").primaryKey().default(1),
  branchName: text("branch_name").notNull().default("NIESV Ebonyi State Branch"),
  registeredAddress: text("registered_address"),
  aboutBody: text("about_body"),

  contactPhones: text("contact_phones"),   // comma separated
  contactEmail: text("contact_email"),
  supportWhatsapp: text("support_whatsapp"),

  logoUrl: text("logo_url"),
  logoPath: text("logo_path"),

  heroImageUrl: text("hero_image_url"),
  heroImagePath: text("hero_image_path"),
  heroImageAlt: text("hero_image_alt"),
  heroTextTone: text("hero_text_tone").notNull().default("dark"),

  /* One account for every event, per the branch. */
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- events (many) ---------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),          // 'mcpd-2026', used in URLs
    title: text("title").notNull(),
    theme: text("theme").notNull().default(""),
    eventType: text("event_type").default("Hybrid event"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    timeLine: text("time_line"),

    venue: text("venue").notNull().default(""),
    venueAddress: text("venue_address").notNull().default(""),

    meetingUrl: text("meeting_url"),
    meetingId: text("meeting_id"),

    flyerUrl: text("flyer_url"),
    flyerPath: text("flyer_path"),
    flyerAlt: text("flyer_alt"),

    status: eventStatus("status").notNull().default("draft"),
    /* The one the home page features. Exactly one should be true; the admin
       clears the others when a new event is promoted. Several events can be
       'open' at once — featured only decides what the home page leads with. */
    isFeatured: boolean("is_featured").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("events_slug_idx").on(t.slug),
    index("events_status_idx").on(t.status, t.startsAt),
  ],
);

/* ---------- per-event content ---------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    key: text("key").notNull(),            // 'fellows' — unique within an event
    name: text("name").notNull(),
    eligibility: text("eligibility").notNull().default(""),
    feeKobo: integer("fee_kobo").notNull(),
    units: integer("units").notNull().default(0),
    requiresMembershipNo: boolean("requires_membership_no").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("categories_event_key_idx").on(t.eventId, t.key)],
);

export const advertRates = pgTable(
  "advert_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    placement: text("placement").notNull(),
    spec: text("spec").notNull().default(""),
    rateKobo: integer("rate_kobo").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("advert_rates_event_idx").on(t.eventId, t.sortOrder)],
);

export const programmeItems = pgTable(
  "programme_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    timeLabel: text("time_label").notNull(),
    title: text("title").notNull(),
    speaker: text("speaker"),
    isBreak: boolean("is_break").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("programme_event_idx").on(t.eventId, t.sortOrder)],
);

/** Site-level hero slides. Deliberately not tied to an event: the branch uses
 *  them for whatever they want to promote, and the button link decides where
 *  each one goes. Managed under Site settings, not Event settings. */
export const heroSlides = pgTable(
  "hero_slides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eyebrow: text("eyebrow"),
    title: text("title").notNull(),
    dateLine: text("date_line"),
    ctaLabel: text("cta_label"),
    ctaHref: text("cta_href"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("hero_slides_published_idx").on(t.published, t.sortOrder)],
);

/* ---------- registrations ---------- */

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => events.id),

    passcode: text("passcode").notNull(),

    title: text("title"),
    surname: text("surname").notNull(),
    firstName: text("first_name").notNull(),
    otherNames: text("other_names"),
    membershipNo: text("membership_no"),
    esvarbonNo: text("esvarbon_no"),

    email: text("email").notNull(),
    phone: text("phone").notNull(),
    firm: text("firm"),
    town: text("town"),

    categoryId: uuid("category_id").notNull().references(() => categories.id),
    mode: attendanceMode("mode").notNull(),
    consentPublish: boolean("consent_publish").notNull().default(false),

    amountKobo: integer("amount_kobo").notNull(),
    txnRef: text("txn_ref").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    proofUrl: text("proof_url"),

    status: paymentStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    confirmedBy: uuid("confirmed_by").references(() => officers.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    photoUrl: text("photo_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Globally unique: a passcode alone must identify a registration, because
    // the photo card, join and certificate gates are given nothing else.
    uniqueIndex("registrations_passcode_idx").on(t.passcode),
    // Per event, not globally — otherwise attending 2026 would block 2027.
    uniqueIndex("registrations_event_membership_idx").on(t.eventId, t.membershipNo),
    index("registrations_event_status_idx").on(t.eventId, t.status),
    index("registrations_email_idx").on(t.email),
    index("registrations_txn_idx").on(t.txnRef),
  ],
);

/** Append-only: a second scan writes a second row rather than overwriting, so
 *  a double scan is visible instead of silent. Event comes via registration. */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
    markedAt: timestamp("marked_at", { withTimezone: true }).defaultNow().notNull(),
    markedBy: uuid("marked_by").references(() => officers.id),
    method: text("method").notNull().default("desk"),
  },
  (t) => [index("attendance_registration_idx").on(t.registrationId)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id, { onDelete: "cascade" }),
    serial: text("serial").notNull(),
    unitsAwarded: integer("units_awarded").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("certificates_serial_idx").on(t.serial),
    uniqueIndex("certificates_registration_idx").on(t.registrationId),
  ],
);

/* ---------- officers and audit ---------- */

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

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    officerId: uuid("officer_id").references(() => officers.id),
    action: text("action").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_target_idx").on(t.targetTable, t.targetId)],
);

export type BranchSettings = typeof branchSettings.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Category = typeof categories.$inferSelect;