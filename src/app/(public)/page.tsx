import Link from "next/link";
import { db, eventSettings } from "@/db";
import CopyButton from "@/components/CopyButton";
import { event, formatNaira } from "@/lib/event";

export default async function Home() {
  const settingsRows = await db.select().from(eventSettings).limit(1);
  const flyer = settingsRows[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${event.eventTitle} — ${event.branch}`,
    description: event.theme,
    startDate: event.date,
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: event.venueAddress || event.venue,
    },
    organizer: { "@type": "Organization", name: event.branch },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. HERO — one static composition, not a carousel */}
      <section className="relative overflow-hidden bg-ink">
        <div className="container-content relative z-10 py-16 md:py-24">
          <p className="mono text-[13px] uppercase tracking-[0.2em] text-gold">
            {event.eventTitle} / Hybrid
          </p>
          <h1 className="mt-5 max-w-[18ch] text-[30px] leading-[1.15] text-white md:text-[46px]">
            {event.theme}
          </h1>

          <dl className="mt-9 max-w-[420px]">
            {[
              ["Date", event.date],
              ["Time", event.time],
              ["Venue", event.venue],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-b border-gold/30 py-3">
                <dt className="mono text-[13px] uppercase tracking-wider text-white/60">{k}</dt>
                <dd className="mono text-[15px] text-white">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Register now</Link>
            <Link href="/join" className="btn-onink">Join online</Link>
          </div>
        </div>

        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/4 select-none font-[var(--font-display)] text-[280px] leading-none text-white/[0.06] lg:block"
        >
          EB
        </span>
      </section>

      {/* 2. AT A GLANCE — the four facts every phone call asks about */}
      <section className="container-content -mt-8 relative z-20">
        <dl className="card grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          {[
            ["Date", event.date],
            ["Venue", event.venue],
            ["Format", "Hybrid"],
            ["Deadline", event.registrationDeadline],
          ].map(([k, v], i) => (
            <div key={k} className={`p-5 ${i < 2 ? "border-b border-line md:border-b-0" : ""} ${i % 2 ? "border-l border-line md:border-l-0" : ""}`}>
              <dt className="mono text-[12px] uppercase tracking-wider text-muted">{k}</dt>
              <dd className={`mono mt-1.5 text-[15px] ${k === "Deadline" ? "text-gold" : "text-ink"}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 3. ABOUT — the flyer sits here as the right-hand column rather than
           at the foot of the page. It is the event's own summary (theme, date,
           venue, fees in one image) and the thing people forward to colleagues,
           so it belongs high on the page, not below the advert rates. It also
           fills a column that was mostly dead space. */}
      <section className="container-content py-14 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="max-w-prose">
            <h2 className="text-[26px]">About the seminar</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              The {event.eventTitle} brings practitioners in Ebonyi State together
              around current standards in estate surveying and valuation practice.
              Sessions address regulatory developments, valuation methodology and
              the tools shaping professional work.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Attendance is open to Fellows, Members, probationers and students of
              the Institution, as well as allied professionals and the general public.
            </p>

            <h3 className="mono mt-10 text-[12px] uppercase tracking-wider text-muted">
              What you leave with
            </h3>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {["MCPD credit units", "E-certificate of participation", "Seminar brochure"].map((x) => (
                <li key={x} className="flex gap-3 text-[15px] text-ink">
                  <span className="mono text-gold" aria-hidden>/</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>

          {flyer?.flyerUrl && (
            <aside>
              <h3 className="mono text-[12px] uppercase tracking-wider text-muted">
                Seminar flyer
              </h3>
              {flyer.flyerUrl.toLowerCase().endsWith(".pdf") ? (
                <a href={flyer.flyerUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4">
                  Open the flyer (PDF)
                </a>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flyer.flyerUrl}
                    alt={flyer.flyerAlt ?? "Seminar flyer"}
                    className="mt-4 w-full rounded border border-line"
                  />
                  <a href={flyer.flyerUrl} download className="btn-secondary mt-4 w-full">
                    Download the flyer
                  </a>
                  <p className="help">Share this with colleagues who have not registered yet.</p>
                </>
              )}
            </aside>
          )}
        </div>
      </section>

      {/* 4. HOW TO REGISTER — the only earned numbered sequence on the site */}
      <section className="border-y border-line bg-white py-14 md:py-20">
        <div className="container-content">
          <h2 className="text-[26px]">How to register</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Pay into the branch account", "Use the account details below and keep your teller or transfer reference."],
              ["02", "Register on this portal", "Complete the form with your transaction reference and proof of payment."],
              ["03", "Receive your passcode", "Sent by email and SMS. It unlocks the session, photo card and certificate."],
            ].map(([n, t, d]) => (
              <li key={n}>
                <span className="mono text-[34px] text-line">{n}</span>
                <h3 className="mt-2 text-[17px] font-semibold text-ink" style={{ fontFamily: "var(--font-body)" }}>{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>

          <p className="mt-10 border-l-2 border-gold bg-paper px-5 py-4 text-[15px] text-ink">
            Registration is required for both physical and virtual participants in
            order to receive the e-certificate.
          </p>
        </div>
      </section>

      {/* 5. BANK DETAILS — highest-value element on the page */}
      <section className="container-content py-14 md:py-20">
        <h2 className="text-[26px]">Bank details</h2>
        <div className="card mt-6 max-w-[560px] p-6">
          <dl>
            <dt className="mono text-[12px] uppercase tracking-wider text-muted">Account number</dt>
            <dd className="mono mt-2 select-all text-[26px] tracking-[0.12em] text-ink">
              {event.accountNumber}
            </dd>
            <dt className="sr-only">Bank</dt>
            <dd className="mt-4 text-[15px] text-muted">{event.bankName}</dd>
            <dt className="sr-only">Account name</dt>
            <dd className="text-[15px] text-muted">{event.accountName}</dd>
          </dl>
          <CopyButton
            value={event.accountNumber}
            label="Copy account number"
            className="btn-primary mt-5"
          />
        </div>
      </section>

      {/* 6. FEES — a real table, never an image */}
      <section className="border-y border-line bg-white py-14 md:py-20">
        <div className="container-content">
          <h2 className="text-[26px]">Registration fees</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Registration fees and MCPD credit units by participation category
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="mono py-3 pr-4 text-[12px] uppercase tracking-wider text-muted">Category</th>
                  <th scope="col" className="mono py-3 px-4 text-right text-[12px] uppercase tracking-wider text-muted">Fee</th>
                  <th scope="col" className="mono py-3 px-4 text-right text-[12px] uppercase tracking-wider text-muted">Units</th>
                  <th scope="col" className="py-3 pl-4 text-right text-[12px] uppercase tracking-wider text-muted mono">Action</th>
                </tr>
              </thead>
              <tbody>
                {event.categories.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-4 pr-4 text-[15px] font-medium text-ink" style={{ fontFamily: "var(--font-body)" }}>
                      {c.name}
                      <span className="block text-[13px] font-normal text-muted">{c.eligibility}</span>
                    </th>
                    <td className="mono px-4 py-4 text-right text-[15px] text-ink whitespace-nowrap">{formatNaira(c.fee)}</td>
                    <td className="mono px-4 py-4 text-right text-[14px] text-muted">{c.units}</td>
                    <td className="py-4 pl-4 text-right">
                      <Link href={`/register?category=${c.id}`} className="text-[14px] text-green underline underline-offset-4">
                        Register
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. ADVERT RATES */}
      <section className="container-content py-14 md:py-20">
        <h2 className="text-[26px]">Brochure adverts and goodwill messages</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Brochure advert placements and rates</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="mono py-3 pr-4 text-[12px] uppercase tracking-wider text-muted">Placement</th>
                <th scope="col" className="mono py-3 pl-4 text-right text-[12px] uppercase tracking-wider text-muted">Rate</th>
              </tr>
            </thead>
            <tbody>
              {event.advertRates.map((a) => (
                <tr key={a.placement} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-4 pr-4 text-[15px] font-medium text-ink" style={{ fontFamily: "var(--font-body)" }}>
                    {a.placement}
                  </th>
                  <td className="mono py-4 pl-4 text-right text-[15px] text-ink">{formatNaira(a.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. PROGRAMME PREVIEW */}
      {event.programme.length > 0 && (
        <section className="border-y border-line bg-white py-14 md:py-20">
          <div className="container-content">
            <h2 className="text-[26px]">Programme</h2>
            <ul className="mt-6">
              {event.programme.slice(0, 5).map((s, i) => (
                <li key={i} className="flex gap-6 border-b border-line py-4 last:border-b-0">
                  <span className="mono w-[72px] shrink-0 text-[14px] text-gold">{s.time}</span>
                  <span>
                    <span className="block text-[17px] font-semibold text-ink" style={{ fontFamily: "var(--font-body)" }}>{s.title}</span>
                    <span className="block text-[15px] text-muted">{s.speaker ?? "Speaker to be announced"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/programme" className="mt-6 inline-block text-[15px] text-green underline underline-offset-4">
              View full programme
            </Link>
          </div>
        </section>
      )}

      {/* 9. CLOSING CTA */}
      <section className="bg-ink py-16">
        <div className="container-content text-center">
          <p className="mono text-[13px] uppercase tracking-[0.2em] text-gold">
            Registration closes {event.registrationDeadline}
          </p>
          <h2 className="mt-4 text-[26px] text-white md:text-[34px]">Secure your place</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary">Register now</Link>
            <Link href="/retrieve" className="btn-onink">Retrieve code</Link>
          </div>
        </div>
      </section>
    </>
  );
}