import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, auditLog, officers } from "@/db";
import { requireOfficer } from "@/lib/auth";

export const metadata: Metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/**
 * Who did what, and when.
 *
 * Every payment confirmation, rejection and settings change already writes a
 * row here; this is the screen that reads them. It matters most when a
 * participant disputes a rejection or a fee looks wrong — the branch can say
 * which officer made the change rather than guessing.
 *
 * Read only, by design. A log an administrator can edit answers no question
 * worth asking.
 *
 * The filters exist because of what the log looks like in practice: a handful
 * of decisions about people's money, buried under dozens of flyer uploads and
 * hero-slide tweaks. Nothing is hidden — but "Money" has to be one click away,
 * or the entries that matter are the ones nobody scrolls to.
 */

const LABELS: Record<string, string> = {
  // money
  confirm_payment: "Confirmed a payment",
  bulk_confirm_payment: "Confirmed several payments",
  reject_payment: "Rejected a payment",
  adjust_amount: "Changed an amount",
  // participants
  update_registration: "Corrected a participant's details",
  delete_registration: "Deleted a registration",
  mark_attendance: "Marked attendance",
  clear_attendance: "Removed an attendance mark",
  resend_passcode: "Resent a passcode",
  // the event and its content
  create_event: "Created an event",
  update_event: "Changed an event",
  delete_event: "Deleted an event",
  feature_event: "Featured an event",
  save_category: "Saved a category",
  delete_category: "Deleted a category",
  add_standard_categories: "Added the standard categories",
  save_advert_rate: "Saved an advert rate",
  delete_advert_rate: "Deleted an advert rate",
  save_programme_item: "Saved a programme item",
  delete_programme_item: "Deleted a programme item",
  upload_flyer: "Uploaded a flyer",
  remove_flyer: "Removed the flyer",
  // the site
  create_page: "Created a page",
  update_page: "Changed a page",
  delete_page: "Deleted a page",
  reorder_pages: "Reordered the menu",
  update_branding: "Changed branding and search settings",
  update_branch_settings: "Changed site settings",
  update_settings: "Changed site settings",
  update_certificate: "Changed the certificate",
  upload_logo: "Changed the crest",
  update_banner: "Changed the page banner",
  remove_banner: "Removed the page banner",
  update_hero_background: "Changed the hero background",
  create_hero_slide: "Added a hero slide",
  update_hero_slide: "Changed a hero slide",
  delete_hero_slide: "Deleted a hero slide",
  // users
  create_officer: "Added a user",
  update_officer: "Changed a user",
  set_officer_role: "Changed a user's role",
  activate_officer: "Reactivated a user",
  deactivate_officer: "Deactivated a user",
  reset_password: "Reset a password",
  change_password: "Changed a password",
};

/** Actions that move money, change a record or grant access. */
const NOTABLE = new Set([
  "reject_payment", "adjust_amount", "delete_event", "delete_page",
  "delete_registration", "update_registration", "clear_attendance",
  "delete_category", "create_officer", "deactivate_officer",
  "set_officer_role", "reset_password", "change_password",
]);

/**
 * The filters. "Everything" is the default — a log that hides rows by default
 * is not a log — but each view is one click away.
 */
const VIEWS = {
  money: {
    label: "Money",
    actions: ["confirm_payment", "bulk_confirm_payment", "reject_payment", "adjust_amount"],
  },
  people: {
    label: "Participants",
    actions: [
      "update_registration", "delete_registration",
      "mark_attendance", "clear_attendance", "resend_passcode",
    ],
  },
  users: {
    label: "Users",
    actions: [
      "create_officer", "update_officer", "set_officer_role",
      "activate_officer", "deactivate_officer", "reset_password", "change_password",
    ],
  },
  content: {
    label: "Site and event",
    actions: [
      "create_event", "update_event", "delete_event", "feature_event",
      "save_category", "delete_category", "add_standard_categories",
      "save_advert_rate", "delete_advert_rate",
      "save_programme_item", "delete_programme_item",
      "upload_flyer", "remove_flyer",
      "create_page", "update_page", "delete_page", "reorder_pages",
      "update_branding", "update_branch_settings", "update_settings",
      "update_certificate", "upload_logo", "update_banner", "remove_banner",
      "update_hero_background", "create_hero_slide", "update_hero_slide",
      "delete_hero_slide",
    ],
  },
} as const;

type ViewKey = keyof typeof VIEWS;
const isView = (v: string | undefined): v is ViewKey => !!v && v in VIEWS;

function when(d: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Africa/Lagos",
  }).format(d);
}

/** Keys that identify a row to the database and nobody else. Printing them
 *  turned a one-line entry into three lines of hex. */
const NOISE = new Set(["updatedAt", "eventId", "id", "registrationId", "officerId", "path", "pathname"]);

/** Kobo in the column, naira on the screen — the log is read by people who
 *  think in naira, and 20000000 is unreadable as a fee. */
function money(kobo: unknown): string {
  const n = Number(kobo);
  return Number.isFinite(n) ? `₦${(n / 100).toLocaleString("en-NG")}` : String(kobo);
}

/** The stored detail is JSON. Show it as a short readable line, never raw. */
function summarise(detail: string | null): string | null {
  if (!detail) return null;
  try {
    const v = JSON.parse(detail);
    if (!v || typeof v !== "object") return null;

    // A settings save records which fields moved.
    if (Array.isArray(v.fields)) {
      const fields = v.fields.filter((f: string) => f !== "updatedAt");
      return fields.length ? `Changed: ${fields.join(", ")}` : null;
    }

    // An edited registration records from/to per field, which is the one case
    // worth spelling out — it is the entry someone will come here to read.
    if (v.changed && typeof v.changed === "object") {
      const parts = Object.entries(v.changed as Record<string, { from: unknown; to: unknown }>)
        .map(([k, c]) => {
          const show = (x: unknown) =>
            x === null || x === undefined || x === ""
              ? "—"
              : k.toLowerCase().endsWith("kobo") ? money(x) : String(x);
          return `${k}: ${show(c.from)} → ${show(c.to)}`;
        });
      return parts.length ? parts.join(" · ").slice(0, 200) : null;
    }

    return Object.entries(v)
      .filter(([k, val]) => !NOISE.has(k) && val !== null && val !== "")
      .map(([k, val]) => `${k}: ${k.toLowerCase().endsWith("kobo") ? money(val) : String(val)}`)
      .join(" · ")
      .slice(0, 140);
  } catch {
    return null;
  }
}

export default async function AuditPage({
  searchParams,
}: { searchParams: Promise<{ page?: string; view?: string }> }) {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const { page: rawPage, view: rawView } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const view = isView(rawView) ? rawView : null;

  const filter = view
    ? inArray(auditLog.action, [...VIEWS[view].actions])
    : undefined;

  const [rows, counted, grand] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetTable: auditLog.targetTable,
        detail: auditLog.detail,
        createdAt: auditLog.createdAt,
        officerName: officers.name,
      })
      .from(auditLog)
      .leftJoin(officers, eq(officers.id, auditLog.officerId))
      .where(filter)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(auditLog).where(filter),
    db.select({ n: sql<number>`count(*)::int` }).from(auditLog),
  ]);

  const total = counted[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) =>
    `/admin/audit?${new URLSearchParams({
      ...(view ? { view } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Activity log</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        Every payment decision, settings change and user change, with the person
        who made it. Kept so the branch can answer a query about a rejected
        payment or an altered fee.
      </p>

      {(grand[0]?.n ?? 0) === 0 ? (
        <div className="card mt-10 p-10 text-center">
          <p className="text-[17px] text-ink">Nothing recorded yet</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-muted">
            Entries appear here as officers confirm payments, mark attendance
            and change settings.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            {([["", "Everything"], ...Object.entries(VIEWS).map(
              ([k, v]) => [k, v.label] as const,
            )] as readonly (readonly [string, string])[]).map(([key, label]) => {
              const active = (view ?? "") === key;
              return (
                <Link
                  key={key || "all"}
                  href={key ? `/admin/audit?view=${key}` : "/admin/audit"}
                  className={`min-h-[40px] rounded border px-4 py-2 text-[14px] ${
                    active
                      ? "border-green bg-green text-white"
                      : "border-line bg-white text-ink hover:border-green"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Three numbers are in play — what is on this page, what the filter
              matches, and what exists — and naming only two of them read as a
              miscount. Spell out the range. */}
          <p className="mono mt-4 text-[13px] uppercase tracking-wider text-muted">
            {total === 0
              ? "No entries"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            {view && total > 0 && ` ${VIEWS[view].label.toLowerCase()} entries · ${grand[0]?.n ?? 0} in all`}
          </p>

          {total === 0 ? (
            <div className="card mt-3 p-10 text-center">
              <p className="text-[15px] text-muted">
                Nothing recorded under {VIEWS[view!].label.toLowerCase()} yet.
              </p>
            </div>
          ) : (
            <ol className="card mt-3 divide-y divide-line">
              {rows.map((r) => {
                const detail = summarise(r.detail);
                const notable = NOTABLE.has(r.action);
                return (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3.5">
                    <span className="mono w-[150px] shrink-0 text-[13px] text-muted">
                      {when(r.createdAt)}
                    </span>

                    <span className="min-w-[240px] flex-1">
                      <span className={`text-[15px] ${notable ? "font-semibold text-ink" : "text-ink"}`}>
                        {LABELS[r.action] ?? r.action.replace(/_/g, " ")}
                      </span>
                      {detail && (
                        <span className="block text-[13px] text-muted">{detail}</span>
                      )}
                    </span>

                    <span className="text-[14px] text-muted">
                      {r.officerName ?? "Deleted user"}
                    </span>

                    <span className="mono text-[12px] text-muted">{r.targetTable}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {pages > 1 && (
            <div className="mt-6 flex items-center gap-4">
              {page > 1 && (
                <Link href={href(page - 1)} className="btn-secondary">Newer</Link>
              )}
              <span className="mono text-[13px] text-muted">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link href={href(page + 1)} className="btn-secondary">Older</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}