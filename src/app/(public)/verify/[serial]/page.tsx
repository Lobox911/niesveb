import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, certificates, registrations, categories, events } from "@/db";
import { getBranch, dateRange } from "@/lib/site";
import PageBanner from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a certificate",
  // Never indexed: these pages carry a participant's name and exist to be
  // reached by scanning a specific certificate, not by searching for a person.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ serial: string }> };

/**
 * What the QR code on a certificate opens.
 *
 * Shows enough for an employer or NIESV national to confirm the certificate is
 * real — name, event, units, date issued — and nothing more. No email, no
 * phone number, no payment detail: the person scanning is a stranger to the
 * participant, and the certificate already tells them the name.
 *
 * An unknown serial says so plainly. Being vague here would only protect a
 * forger, since a genuine holder can read their serial off the page.
 */
export default async function VerifyPage({ params }: Props) {
  const { serial: rawSerial } = await params;
  const serial = decodeURIComponent(rawSerial).trim();

  const [branch, rows] = await Promise.all([
    getBranch(),
    db
      .select({
        serial: certificates.serial,
        units: certificates.unitsAwarded,
        issuedAt: certificates.issuedAt,
        title: registrations.title,
        firstName: registrations.firstName,
        otherNames: registrations.otherNames,
        surname: registrations.surname,
        categoryName: categories.name,
        eventTitle: events.title,
        eventTheme: events.theme,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        venue: events.venue,
      })
      .from(certificates)
      .innerJoin(registrations, eq(registrations.id, certificates.registrationId))
      .innerJoin(categories, eq(categories.id, registrations.categoryId))
      .innerJoin(events, eq(events.id, registrations.eventId))
      .where(eq(certificates.serial, serial))
      .limit(1),
  ]);

  const c = rows[0];

  if (!c) {
    return (
      <>
        <PageBanner title="Certificate verification" crumb="Verify" />
        <div className="container-content py-16">
          <div className="mx-auto max-w-[560px]">
            <div className="card border-danger p-8 text-center">
              <p className="mono inline-flex rounded border border-danger/40 bg-danger/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-danger">
                No record
              </p>
              <h1 className="mt-5 text-[24px] text-ink">This serial is not on our register</h1>
              <p className="mx-auto mt-3 max-w-[46ch] text-[16px] leading-relaxed text-muted">
                No certificate with the serial{" "}
                <span className="mono text-ink">{serial}</span> has been issued
                by {branch.branchName}.
              </p>
              <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted">
                Check the serial against the printed certificate — the letter O
                and the digit 0 are easily confused. If it still does not match,
                contact the branch.
              </p>
              {branch.contactPhones.length > 0 && (
                <p className="mt-5 text-[15px] text-ink">
                  {branch.contactPhones.join(" · ")}
                  {branch.contactEmail ? ` · ${branch.contactEmail}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const name = [c.title, c.firstName, c.otherNames, c.surname].filter(Boolean).join(" ");
  const issued = new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos",
  }).format(c.issuedAt);

  return (
    <>
      <PageBanner title="Certificate verification" crumb="Verify" />
      <div className="container-content py-16">
        <div className="mx-auto max-w-[560px]">
          <div className="card p-8">
            <p className="mono inline-flex items-center gap-2 rounded border border-green/40 bg-green/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Genuine certificate
            </p>

            <h1 className="mt-5 text-[26px] leading-tight text-ink">{name}</h1>
            <p className="mt-2 text-[16px] leading-relaxed text-muted">
              participated in the {c.eventTitle}
              {c.eventTheme ? `, "${c.eventTheme}"` : ""}, held on{" "}
              {dateRange(c.startsAt, c.endsAt)} at {c.venue}.
            </p>

            <dl className="mt-8 divide-y divide-line border-t border-line">
              {[
                ["Serial", c.serial],
                ["Category", c.categoryName],
                ["MCPD credit units", String(c.units)],
                ["Issued", issued],
                ["Issued by", branch.branchName],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-6 py-3">
                  <dt className="text-[14px] text-muted">{label}</dt>
                  <dd className={`text-right text-[15px] text-ink ${label === "Serial" ? "mono" : ""}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="help mt-6 text-center">
            This record is held by {branch.branchName}. To query it, contact the
            branch directly.
          </p>
        </div>
      </div>
    </>
  );
}