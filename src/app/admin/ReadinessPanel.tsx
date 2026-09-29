import Link from "next/link";
import type { Readiness } from "@/lib/readiness";

const TONE = {
  blocker: {
    chip: "border-danger/40 bg-danger/10 text-danger",
    label: "Blocking",
    rule: "border-l-danger",
  },
  warning: {
    chip: "border-gold/40 bg-gold/10 text-gold",
    label: "Needs attention",
    rule: "border-l-gold",
  },
  note: {
    chip: "border-line bg-paper text-muted",
    label: "Worth knowing",
    rule: "border-l-line",
  },
} as const;

/**
 * The first thing on the dashboard.
 *
 * Everything it reports is something the site currently does quietly and
 * wrongly. Put anywhere else it would be a page nobody opens; at the top of
 * the screen the branch already looks at every day, it is read.
 *
 * When there is nothing wrong it collapses to a single line rather than a
 * green panel — a checklist that takes up space when it has nothing to say
 * teaches people to scroll past it.
 */
export default function ReadinessPanel({ readiness }: { readiness: Readiness }) {
  const { checks, blockers, warnings, ready } = readiness;

  if (checks.length === 0) {
    return (
      <p className="mt-6 flex items-center gap-2 text-[15px] text-green">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Everything is set up. Nothing needs attention.
      </p>
    );
  }

  return (
    <section aria-labelledby="readiness-heading" className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="readiness-heading" className="text-[20px] text-ink">
          Before the seminar
        </h2>
        <p className="text-[14px] text-muted">
          {blockers > 0
            ? `${blockers} ${blockers === 1 ? "thing is" : "things are"} stopping the site working properly`
            : warnings > 0
              ? `${warnings} ${warnings === 1 ? "thing needs" : "things need"} attention`
              : "A few things worth knowing"}
        </p>
      </div>

      {!ready && (
        <p className="mt-2 max-w-prose text-[15px] text-danger">
          Each of these fails silently on the public site — nobody is told, and
          nothing appears in a log.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {checks.map((c) => {
          const tone = TONE[c.severity];
          return (
            <li key={c.id} className={`card border-l-4 ${tone.rule} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[280px] flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`mono rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider ${tone.chip}`}>
                      {tone.label}
                    </span>
                    <h3 className="text-[16px] text-ink">{c.title}</h3>
                  </div>
                  <p className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-muted">
                    {c.detail}
                  </p>
                </div>

                {c.fixHref && (
                  <Link href={c.fixHref} className="btn-secondary shrink-0 px-4 py-2 text-[14px]">
                    {c.fixLabel ?? "Fix"}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}