import { asc, eq } from "drizzle-orm";
import { db, pages } from "@/db";

/**
 * The seven pages that carry machinery.
 *
 * Each one lists the text slots the branch may rewrite, with the wording the
 * site ships with. Defaults live here rather than in the database so that a
 * slot nobody has touched keeps improving when this file does — only genuine
 * overrides are stored.
 *
 * `path` is the route in code. It exists whether or not a row exists, which is
 * why a system page can be hidden from the menu but never deleted.
 */

export type Slot = { key: string; label: string; help?: string; long?: boolean; value: string };
export type SystemPage = {
  slug: string;
  path: string;
  name: string;
  navLabel: string;
  navOrder: number;
  showInNav: boolean;
  purpose: string;
  slots: Slot[];
};

export const SYSTEM_PAGES: SystemPage[] = [
  {
    slug: "home",
    path: "/",
    name: "Home",
    navLabel: "Home",
    navOrder: 10,
    showInNav: true,
    purpose: "The front page. Leads with the featured event and the fee schedule.",
    slots: [
      { key: "aboutHeading", label: "About section heading", value: "About the branch" },
      { key: "feesHeading", label: "Fee schedule heading", value: "Participation categories" },
      {
        key: "feesIntro", label: "Fee schedule introduction", long: true,
        help: "Shown above the table of categories and fees.",
        value: "Fees cover participation, materials and the certificate of participation. Select the category that applies to you when registering.",
      },
      { key: "programmeHeading", label: "Programme heading", value: "Programme" },
      { key: "advertHeading", label: "Advert rates heading", value: "Advertisement rates" },
      {
        key: "advertIntro", label: "Advert rates introduction", long: true,
        value: "Firms wishing to advertise in the seminar brochure may book any of the placements below.",
      },
      { key: "paymentHeading", label: "Payment heading", value: "Payment" },
      {
        key: "paymentIntro", label: "Payment instructions", long: true,
        help: "Shown with the bank details. Say how you want people to pay.",
        value: "Pay the fee for your category into the branch account below, then attach the teller or receipt when you register.",
      },
    ],
  },
  {
    slug: "register",
    path: "/register",
    name: "Register",
    navLabel: "Register",
    navOrder: 20,
    showInNav: true,
    purpose: "The registration form. Writes to the database and emails the participant.",
    slots: [
      { key: "title", label: "Page heading", value: "Register for the seminar" },
      {
        key: "intro", label: "Introduction", long: true,
        value: "Complete the form below. Use an email address you check — your participation code is sent there once your payment is confirmed.",
      },
      {
        key: "closedMessage", label: "Message when registration has closed", long: true,
        value: "Registration for this event has closed. Contact the branch if you believe this is an error.",
      },
      {
        key: "paymentNote", label: "Payment note", long: true,
        value: "Pay into the branch account before completing this form, and attach the teller or receipt.",
      },
    ],
  },
  {
    slug: "programme",
    path: "/programme",
    name: "Programme",
    navLabel: "Programme",
    navOrder: 30,
    showInNav: true,
    purpose: "The running order for the featured event.",
    slots: [
      { key: "title", label: "Page heading", value: "Programme" },
      { key: "intro", label: "Introduction", long: true, value: "The running order for the seminar." },
      { key: "empty", label: "Message when no programme is set", long: true, value: "The programme for this event has not been published yet." },
    ],
  },
  {
    slug: "retrieve",
    path: "/retrieve",
    name: "Retrieve code",
    navLabel: "Retrieve code",
    navOrder: 40,
    showInNav: true,
    purpose: "Looks up a registration by membership number or email.",
    slots: [
      { key: "title", label: "Page heading", value: "Retrieve your code" },
      {
        key: "intro", label: "Introduction", long: true,
        value: "Enter the membership number or email address you registered with and we will show your participation code.",
      },
    ],
  },
  {
    slug: "photo-card",
    path: "/photo-card",
    name: "Photo card",
    navLabel: "Photo card",
    navOrder: 50,
    showInNav: true,
    purpose: "Passcode gate. Produces the printable participant card.",
    slots: [
      { key: "title", label: "Page heading", value: "Your photo card" },
      {
        key: "intro", label: "Introduction", long: true,
        value: "Enter your participation code to make the card you will wear at the venue.",
      },
      {
        key: "help", label: "Guidance on the photograph", long: true,
        value: "Use a clear head-and-shoulders photograph against a plain background, as you would for a passport.",
      },
    ],
  },
  {
    slug: "join",
    path: "/join",
    name: "Join online",
    navLabel: "Join online",
    navOrder: 60,
    showInNav: false,
    purpose: "Passcode gate. Releases the meeting link to virtual participants.",
    slots: [
      { key: "title", label: "Page heading", value: "Join the session online" },
      {
        key: "intro", label: "Introduction", long: true,
        value: "Enter your participation code to open the meeting link. The link becomes available 30 minutes before the session starts.",
      },
      {
        key: "early", label: "Message before the link opens", long: true,
        value: "The meeting link is not open yet. Come back 30 minutes before the session starts.",
      },
    ],
  },
  {
    slug: "certificate",
    path: "/certificate",
    name: "Certificate",
    navLabel: "Certificate",
    navOrder: 70,
    showInNav: true,
    purpose: "Passcode gate. Issues the certificate of participation after attendance.",
    slots: [
      { key: "title", label: "Page heading", value: "Certificate of participation" },
      {
        key: "intro", label: "Introduction", long: true,
        value: "Enter your participation code to download your certificate.",
      },
      {
        key: "notYet", label: "Message before attendance is recorded", long: true,
        value: "Your certificate opens once your attendance at the seminar has been recorded.",
      },
    ],
  },
];

export const systemPage = (slug: string) => SYSTEM_PAGES.find((p) => p.slug === slug);

/** The shipped wording for one page, as a plain object. */
function defaults(slug: string): Record<string, string> {
  const sys = systemPage(slug);
  if (!sys) return {};
  return Object.fromEntries(sys.slots.map((s) => [s.key, s.value]));
}

function parseCopy(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Copy for a system page: shipped wording, with any branch override on top.
 * Never throws and never returns a blank string for a known slot, so a page
 * cannot end up with an empty heading because a row is missing.
 */
export async function getCopy(slug: string): Promise<Record<string, string>> {
  const base = defaults(slug);
  try {
    const rows = await db.select({ copy: pages.copy, title: pages.title, intro: pages.intro })
      .from(pages).where(eq(pages.slug, slug)).limit(1);
    const row = rows[0];
    if (!row) return base;

    const over = parseCopy(row.copy);
    const merged = { ...base };
    for (const [k, v] of Object.entries(over)) {
      if (typeof v === "string" && v.trim()) merged[k] = v.trim();
    }
    return merged;
  } catch {
    // A page must render even if the database is unreachable.
    return base;
  }
}

/** A custom page by slug, or null. Only published pages are returned. */
export async function getCustomPage(slug: string) {
  const rows = await db.select().from(pages)
    .where(eq(pages.slug, slug)).limit(1);
  const p = rows[0];
  if (!p || p.kind !== "custom" || !p.published) return null;
  return p;
}

export type NavItem = { href: string; label: string };

/**
 * The menu, ordered. System pages resolve to their route in code; custom pages
 * to /slug. Unpublished and hidden pages are left out.
 */
export async function getNav(): Promise<NavItem[]> {
  try {
    const rows = await db.select({
      slug: pages.slug, kind: pages.kind, title: pages.title,
      navLabel: pages.navLabel, showInNav: pages.showInNav,
      navOrder: pages.navOrder, published: pages.published,
    }).from(pages).orderBy(asc(pages.navOrder));

    const items = rows
      .filter((r) => r.showInNav && r.published)
      .map((r) => ({
        href: r.kind === "system" ? (systemPage(r.slug)?.path ?? `/${r.slug}`) : `/${r.slug}`,
        label: r.navLabel || r.title,
      }));

    if (items.length) return items;
  } catch {
    // fall through to the shipped menu
  }

  // Nothing seeded yet, or the database is unreachable: the site still needs
  // a working menu.
  return SYSTEM_PAGES.filter((p) => p.showInNav)
    .sort((a, b) => a.navOrder - b.navOrder)
    .map((p) => ({ href: p.path, label: p.navLabel }));
}

/**
 * Body text for a custom page, turned into blocks.
 *
 * Markdown would mean a parser and a sanitiser for the sake of two features
 * the branch actually needs, and any HTML path invites a pasted script. A
 * blank line starts a paragraph and a leading '## ' makes a heading; nothing
 * else is interpreted, so no input can produce markup.
 */
export type Block = { type: "h2" | "p"; text: string };

export function toBlocks(body: string | null): Block[] {
  if (!body) return [];
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith("## ")
        ? { type: "h2" as const, text: chunk.slice(3).trim() }
        : { type: "p" as const, text: chunk },
    );
}

/** Slugs the branch may not take, because a route in code already answers. */
export const RESERVED_SLUGS = new Set([
  ...SYSTEM_PAGES.map((p) => p.slug),
  "admin", "api", "verify", "register", "join", "certificate",
  "photo-card", "programme", "retrieve", "sitemap.xml", "robots.txt",
]);

/** Lower case, hyphens, no leading or trailing hyphen. */
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
}

/**
 * Per-page search title and description, from the Pages section.
 *
 * Falls back to the page's own name so a blank field never produces an empty
 * tag, and returns nothing at all if the row is missing, which leaves the
 * site-wide metadata in the root layout in charge.
 */
export async function pageMeta(slug: string) {
  try {
    const rows = await db
      .select({
        title: pages.title,
        metaTitle: pages.metaTitle,
        metaDescription: pages.metaDescription,
      })
      .from(pages)
      .where(eq(pages.slug, slug))
      .limit(1);

    const row = rows[0];
    const sys = systemPage(slug);
    const title = row?.metaTitle?.trim() || row?.title?.trim() || sys?.name;

    return {
      title,
      description: row?.metaDescription?.trim() || undefined,
      alternates: { canonical: sys?.path ?? `/${slug}` },
    };
  } catch {
    return {};
  }
}