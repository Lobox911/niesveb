import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import JoinGate from "./JoinGate";
import { getFeaturedEvent, dateRange } from "@/lib/site";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("join");
}

/**
 * Three states, derived from the real start time.
 *
 * This page previously imported the placeholder event file and hardcoded the
 * state to "before", so the gate was unreachable and the date shown was
 * invented — a virtual participant could never join, whatever their code.
 *
 * The link opens 30 minutes ahead because people arrive early and a locked
 * page at 08:55 produces phone calls. It stays open until three hours after
 * the end, so anyone rejoining after a dropout is not shut out.
 */

const OPENS_MINUTES_BEFORE = 30;
const CLOSES_HOURS_AFTER = 3;

export default async function JoinPage() {
  const [event, copy] = await Promise.all([getFeaturedEvent(), getCopy("join")]);

  if (!event) {
    return (
      <>
        <PageBanner title={copy.title} crumb="Join online" />
        <div className="container-content py-14">
          <p className="mx-auto max-w-prose text-center text-[17px] text-muted">
            There is no seminar scheduled at the moment. The branch will
            announce the next one here.
          </p>
        </div>
      </>
    );
  }

  const now = Date.now();
  const opensAt = event.startsAt.getTime() - OPENS_MINUTES_BEFORE * 60_000;
  const endsAt = (event.endsAt ?? event.startsAt).getTime() + CLOSES_HOURS_AFTER * 3_600_000;

  const state: "before" | "open" | "after" =
    now < opensAt ? "before" : now > endsAt ? "after" : "open";

  const startLabel = new Intl.DateTimeFormat("en-NG", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Africa/Lagos",
  }).format(event.startsAt);

  return (
    <>
      <PageBanner title={copy.title} crumb="Join online" />
      <div className="container-content py-14">
        {state === "before" && (
          <div className="mx-auto max-w-[520px] text-center">
            <p className="mono text-[13px] uppercase tracking-wider text-muted">Session opens</p>
            <p className="mt-3 text-[26px] leading-tight text-ink">{startLabel}</p>
            <p className="mono mt-2 text-[15px] text-muted">
              {dateRange(event.startsAt, event.endsAt)}
            </p>
            <p className="mx-auto mt-6 max-w-[46ch] text-[16px] leading-relaxed text-muted">
              {copy.early}
            </p>
          </div>
        )}

        {state === "open" && (
          <>
            <p className="mx-auto mb-10 max-w-prose text-[17px] leading-relaxed text-muted">
              {copy.intro}
            </p>
            <JoinGate />
          </>
        )}

        {state === "after" && (
          <div className="mx-auto max-w-[520px] text-center">
            <p className="text-[19px] text-ink">This session has ended.</p>
            <p className="mx-auto mt-3 max-w-[46ch] text-[16px] leading-relaxed text-muted">
              If your attendance was recorded, your certificate of participation
              is now available.
            </p>
            <a href="/certificate" className="btn-primary mt-7 min-h-[50px] px-8">
              Get my certificate
            </a>
          </div>
        )}
      </div>
    </>
  );
}