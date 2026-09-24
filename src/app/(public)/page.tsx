import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, heroSlides } from "@/db";
import HeroSlider from "@/components/HeroSlider";
import BackToTop from "@/components/BackToTop";
import CopyButton from "@/components/CopyButton";
import { getBranch, getFeaturedEvent, getEventView } from "@/lib/site";

export default async function Home() {
  const featured = await getFeaturedEvent();
  const [branch, slides] = await Promise.all([
    getBranch(),
    db.select().from(heroSlides).where(eq(heroSlides.published, true)).orderBy(asc(heroSlides.sortOrder)),
  ]);

  // No open event: the page still renders the branch, so the site is never
  // blank between seminars.
  const event = featured ? await getEventView(featured) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${event?.title} — ${branch.branchName}`,
    description: event?.theme ?? "",
    startDate: event?.date ?? "",
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event?.venue ?? "",
      address: event?.venueAddress || event?.venue || "",
    },
    organizer: { "@type": "Organization", name: branch.branchName },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. HERO — a slider when the branch has published upcoming events,
           otherwise the static theme hero. The fallback matters: the page must
           never depend on a slide existing. */}
      <HeroSlider
        slides={
          slides.length > 0
            ? slides
            : [
                // No published slides: the seminar itself becomes the slide, so
                // the hero keeps one implementation rather than a second layout
                // that drifts out of step.
                {
                  id: "fallback",
                  eyebrow: event?.eventType ?? null,
                  title: event?.title || branch.branchName,
                  dateLine: event?.date ?? null,
                  ctaLabel: "Register now",
                  ctaHref: "/register",
                },
              ]
        }
        backgroundUrl={branch.heroImageUrl}
        backgroundAlt={branch.heroImageAlt}
        tone={branch.heroTextTone}
        fallbackDate={event?.date ?? ""}
        fallbackEyebrow={event?.eventType}
      />

      {/* 1b. CERTIFICATE BAND — a returning participant comes back for exactly
           one thing, and should not have to find it in the nav. Full width,
           directly under the hero, solid ink. */}
      <section className="border-y border-white/10 bg-ink">
        <div className="container-content flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 text-center">
          <Link
            href="/certificate"
            className="mono text-[14px] uppercase tracking-[0.15em] text-white underline-offset-4 hover:underline"
          >
            Print your certificate
          </Link>
          <span aria-hidden className="text-white/30">·</span>
          <Link
            href="/retrieve"
            className="mono text-[14px] uppercase tracking-[0.15em] text-white/70 underline-offset-4 hover:text-white hover:underline"
          >
            Retrieve your passcode
          </Link>
        </div>
      </section>

      {/* 2. EVENT DETAILS — the theme belongs here, not in the hero. It runs to
           several lines and reads as a subject line rather than a headline.
           The three cards answer the questions that otherwise become phone
           calls: where, how to pay, and whether registration is required. */}
      <section className="border-b border-line bg-white py-14 md:py-20">
        <div className="container-content text-center">
          <p className="mono text-[13px] uppercase tracking-[0.2em] text-gold">Event details</p>
          <h2 className="mt-4 text-[30px] font-bold text-ink md:text-[38px]">
            {event?.title ?? branch.branchName}
          </h2>
          {event?.theme && (
            <p className="mx-auto mt-5 max-w-[46ch] text-[18px] font-semibold leading-relaxed text-ink md:text-[20px]">
              Theme: {event.theme}
            </p>
          )}
          {event?.date && (
            <p className="mono mt-5 text-[17px] text-green">Date: {event.date}</p>
          )}

          <div className="mt-12 grid gap-5 text-left md:grid-cols-3">
            <div className="card border-t-2 border-t-green p-6">
              <h3 className="text-[17px] font-semibold text-ink">Venue</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {event?.venueAddress || event?.venue || "To be announced"}
              </p>
              {event?.time && <p className="mono mt-3 text-[14px] text-muted">{event.time}</p>}
            </div>

            <div className="card border-t-2 border-t-gold p-6">
              <h3 className="text-[17px] font-semibold text-ink">Bank details</h3>
              <p className="mono mt-2 select-all text-[17px] text-ink">{branch.accountNumber}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {branch.bankName}
                {branch.accountName ? <><br />{branch.accountName}</> : null}
              </p>
            </div>

            <div className="card border-t-2 border-t-ink p-6">
              <h3 className="text-[17px] font-semibold text-ink">Registration</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Registration is mandatory for both physical and virtual
                participants in order to secure your e-certificate.
              </p>
              {event?.registrationDeadline && (
                <p className="mono mt-3 text-[14px] text-gold">
                  Closes {event.registrationDeadline}
                </p>
              )}
            </div>
          </div>
        </div>
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
            {(branch.aboutBody.length > 0
              ? branch.aboutBody
              : [
                  `The ${event?.title} brings practitioners in Ebonyi State together around current standards in estate surveying and valuation practice. Sessions address regulatory developments, valuation methodology and the tools shaping professional work.`,
                  "Attendance is open to Fellows, Members, probationers and students of the Institution, as well as allied professionals and the general public.",
                ]
            ).map((para: string, n: number) => (
              <p key={n} className="mt-4 text-[17px] leading-relaxed text-muted">
                {para}
              </p>
            ))}

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

          {event?.flyerUrl && (
            <aside>
              <h3 className="mono text-[12px] uppercase tracking-wider text-muted">
                Seminar flyer
              </h3>
              {event?.flyerUrl.toLowerCase().endsWith(".pdf") ? (
                <a href={event?.flyerUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4">
                  Open the flyer (PDF)
                </a>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event?.flyerUrl}
                    alt={event?.flyerAlt ?? "Seminar flyer"}
                    className="mt-4 w-full rounded border border-line"
                  />
                  <a href={event?.flyerUrl} download className="btn-secondary mt-4 w-full">
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
              {branch.accountNumber}
            </dd>
            <dt className="sr-only">Bank</dt>
            <dd className="mt-4 text-[15px] text-muted">{branch.bankName}</dd>
            <dt className="sr-only">Account name</dt>
            <dd className="text-[15px] text-muted">{branch.accountName}</dd>
          </dl>
          <CopyButton
            value={branch.accountNumber}
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
                {(event?.categories ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-4 pr-4 text-[15px] font-medium text-ink" style={{ fontFamily: "var(--font-body)" }}>
                      {c.name}
                      <span className="block text-[13px] font-normal text-muted">{c.eligibility}</span>
                    </th>
                    <td className="mono px-4 py-4 text-right text-[15px] text-ink whitespace-nowrap">{c.feeLabel}</td>
                    <td className="mono px-4 py-4 text-right text-[14px] text-muted">{c.units}</td>
                    <td className="py-4 pl-4 text-right">
                      <Link href={`/register?category=${c.key}`} className="text-[14px] text-green underline underline-offset-4">
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
              {(event?.advertRates ?? []).map((a) => (
                <tr key={a.placement} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-4 pr-4 text-[15px] font-medium text-ink" style={{ fontFamily: "var(--font-body)" }}>
                    {a.placement}
                  </th>
                  <td className="mono py-4 pl-4 text-right text-[15px] text-ink">{a.rateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. PROGRAMME PREVIEW */}
      {(event?.programme ?? []).length > 0 && (
        <section className="border-y border-line bg-white py-14 md:py-20">
          <div className="container-content">
            <h2 className="text-[26px]">Programme</h2>
            <ul className="mt-6">
              {(event?.programme ?? []).slice(0, 5).map((s, i) => (
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
            Registration closes {event?.registrationDeadline ?? ""}
          </p>
          <h2 className="mt-4 text-[26px] text-white md:text-[34px]">Secure your place</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary">Register now</Link>
            <Link href="/retrieve" className="btn-onink">Retrieve code</Link>
          </div>
        </div>
      </section>
      <BackToTop />
    </>
  );
}