import { and, eq, sql } from "drizzle-orm";
import {
  db, branchSettings, events, categories, programmeItems, registrations, officers, pages,
} from "@/db";
import { emailEnabled } from "./email";

/**
 * What is wrong right now.
 *
 * Every item here is something the site currently does silently: no event
 * marked featured means a blank home page, no bank account means people
 * cannot pay, registration open past its deadline means the form refuses
 * everyone with a message nobody expects. None of these throw, none appear in
 * a log, and all of them are discovered by a participant rather than by the
 * branch.
 *
 * Severities are honest. 'blocker' means the seminar cannot run, 'warning'
 * means something will go wrong for somebody, 'note' is worth knowing. A
 * checklist that cries wolf gets ignored, so anything cosmetic stays off it.
 */

export type Check = {
  id: string;
  severity: "blocker" | "warning" | "note";
  title: string;
  detail: string;
  fixHref?: string;
  fixLabel?: string;
};

export type Readiness = {
  checks: Check[];
  blockers: number;
  warnings: number;
  ready: boolean;
};

export async function getReadiness(): Promise<Readiness> {
  const checks: Check[] = [];

  const [settingsRows, featuredRows, openRows, officerRows, pageRows] = await Promise.all([
    db.select().from(branchSettings).limit(1),
    db.select().from(events).where(eq(events.isFeatured, true)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(officers).where(eq(officers.active, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(pages),
  ]);

  const b = settingsRows[0];
  const featured = featuredRows[0];
  const openCount = openRows[0]?.n ?? 0;

  /* ---- the event ---- */

  if (!featured && openCount === 0) {
    checks.push({
      id: "no-event",
      severity: "blocker",
      title: "No event is published",
      detail:
        "The home page has nothing to lead with and registration is closed to everyone. Create an event and set its status to open.",
      fixHref: "/admin/events",
      fixLabel: "Events",
    });
  } else if (!featured) {
    checks.push({
      id: "nothing-featured",
      severity: "warning",
      title: "No event is marked as featured",
      detail:
        "The home page is falling back to the soonest open event. Tick 'featured' on the one the branch wants people to see first.",
      fixHref: "/admin/events",
      fixLabel: "Events",
    });
  }

  if (featured) {
    const [cats, programme, regs] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(categories).where(eq(categories.eventId, featured.id)),
      db.select({ n: sql<number>`count(*)::int` }).from(programmeItems).where(eq(programmeItems.eventId, featured.id)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(registrations)
        .where(and(eq(registrations.eventId, featured.id), eq(registrations.status, "pending"))),
    ]);

    if ((cats[0]?.n ?? 0) === 0) {
      checks.push({
        id: "no-categories",
        severity: "blocker",
        title: "The featured event has no participation categories",
        detail:
          "Nobody can register: the form has nothing to select and no fee to charge. Add at least one category.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }

    if (featured.status === "open" && featured.registrationDeadline && featured.registrationDeadline < new Date()) {
      checks.push({
        id: "deadline-passed",
        severity: "blocker",
        title: "Registration is open but the deadline has passed",
        detail:
          "The form is reachable and refuses every submission. Either extend the deadline or close registration so the page says so honestly.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }

    if (featured.status === "draft") {
      checks.push({
        id: "draft",
        severity: "warning",
        title: "The featured event is still a draft",
        detail: "Draft events do not appear on the public site at all.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }

    if (!featured.venue?.trim()) {
      checks.push({
        id: "no-venue",
        severity: "warning",
        title: "The event has no venue",
        detail: "It appears blank on the home page, in the registration form and in every email.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }

    if ((programme[0]?.n ?? 0) === 0) {
      checks.push({
        id: "no-programme",
        severity: "note",
        title: "No programme has been published",
        detail: "The programme page shows a placeholder until sessions are added.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }

    const pending = regs[0]?.n ?? 0;
    if (pending > 0) {
      checks.push({
        id: "pending-payments",
        severity: pending > 20 ? "warning" : "note",
        title: `${pending} ${pending === 1 ? "payment is" : "payments are"} awaiting confirmation`,
        detail:
          "Nobody in this group has a participation code yet, so none of them can join online, print a card or be marked present.",
        fixHref: "/admin?status=pending",
        fixLabel: "Review",
      });
    }

    // Virtual attendance is offered on the form regardless, so a missing link
    // strands anyone who chose it.
    if (!featured.meetingUrl?.trim()) {
      checks.push({
        id: "no-meeting-link",
        severity: "note",
        title: "No meeting link is set",
        detail:
          "Virtual participants can register but the Join page has nothing to give them.",
        fixHref: `/admin/events/${featured.id}`,
        fixLabel: "Edit event",
      });
    }
  }

  /* ---- taking money ---- */

  if (!b?.accountNumber?.trim() || !b?.bankName?.trim()) {
    checks.push({
      id: "no-bank",
      severity: "blocker",
      title: "No bank account is set",
      detail:
        "The registration page and the confirmation email have nowhere to tell people to pay.",
      fixHref: "/admin/site#branch",
      fixLabel: "Site settings",
    });
  } else if (!/^\d{10}$/.test(b.accountNumber.replace(/\s/g, ""))) {
    checks.push({
      id: "odd-account",
      severity: "warning",
      title: "The account number does not look like ten digits",
      detail:
        `Currently "${b.accountNumber}". Nigerian account numbers are ten digits — check it before anyone transfers money to it.`,
      fixHref: "/admin/site#branch",
      fixLabel: "Site settings",
    });
  }

  /* ---- reaching people ---- */

  if (!emailEnabled()) {
    checks.push({
      id: "no-email",
      severity: "blocker",
      title: "Email is not configured",
      detail:
        "No registration confirmations and no participation codes are being sent. Set RESEND_API_KEY and MAIL_FROM.",
    });
  }

  if (!b?.contactPhones?.trim()) {
    checks.push({
      id: "no-phone",
      severity: "warning",
      title: "No contact phone number",
      detail: "It appears in the footer and on every rejection message, so people have no way to query anything.",
      fixHref: "/admin/site#branch",
      fixLabel: "Site settings",
    });
  }

  /* ---- certificates ---- */

  if (!b?.chairmanName?.trim() && !b?.secretaryName?.trim()) {
    checks.push({
      id: "no-signatories",
      severity: "warning",
      title: "No signatories are set for the certificate",
      detail:
        "Certificates will print with an empty signature block. Add at least the chairman's name.",
      fixHref: "/admin/site#certificate",
      fixLabel: "Certificate settings",
    });
  }

  if (!b?.logoUrl) {
    checks.push({
      id: "no-crest",
      severity: "note",
      title: "No branch crest has been uploaded",
      detail: "The header shows a placeholder mark and the certificate prints without a crest.",
      fixHref: "/admin/site#crest",
      fixLabel: "Site settings",
    });
  }

  /* ---- search ---- */

  if (!b?.canonicalUrl?.trim()) {
    checks.push({
      id: "no-canonical",
      severity: "warning",
      title: "No website address is set",
      detail:
        "More than one address reaches this site, and without this setting search engines treat them as competing sites. The sitemap is also empty until it is filled in.",
      fixHref: "/admin/site#branding",
      fixLabel: "Branding and search",
    });
  }

  if (b && b.searchIndexable === false) {
    checks.push({
      id: "noindex",
      severity: "warning",
      title: "The site is hidden from search engines",
      detail:
        "This is correct while the site is being prepared. Turn it back on once the seminar is announced, because Google takes weeks to restore pages.",
      fixHref: "/admin/site#branding",
      fixLabel: "Branding and search",
    });
  }

  if (!b?.metaDescription?.trim()) {
    checks.push({
      id: "no-description",
      severity: "note",
      title: "No search description",
      detail: "Google will invent one from the page text, and so will WhatsApp when the link is shared.",
      fixHref: "/admin/site#branding",
      fixLabel: "Branding and search",
    });
  }

  /* ---- accounts ---- */

  if ((officerRows[0]?.n ?? 0) < 2) {
    checks.push({
      id: "one-officer",
      severity: "note",
      title: "Only one account can sign in",
      detail:
        "If that password is lost there is no way into the dashboard. Add a second administrator.",
      fixHref: "/admin/officers",
      fixLabel: "Users",
    });
  }

  if ((pageRows[0]?.n ?? 0) === 0) {
    checks.push({
      id: "no-pages",
      severity: "note",
      title: "Page settings have not been set up yet",
      detail: "Open the Pages section once to create them.",
      fixHref: "/admin/pages",
      fixLabel: "Pages",
    });
  }

  const order = { blocker: 0, warning: 1, note: 2 };
  checks.sort((a, c) => order[a.severity] - order[c.severity]);

  const blockers = checks.filter((c) => c.severity === "blocker").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;

  return { checks, blockers, warnings, ready: blockers === 0 };
}