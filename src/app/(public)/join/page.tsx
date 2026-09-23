import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PasscodeGate from "@/components/PasscodeGate";
import { event } from "@/lib/event";

export const metadata: Metadata = { title: "Join online" };

/**
 * State machine: BEFORE / OPEN / LIVE / AFTER.
 * TODO: derive from the real event start time once event.date is a Date.
 */
export default function JoinPage() {
  type JoinState = "before" | "open" | "after";
  // TODO: derive from the real start time. Hardcoded until event.date is a Date.
  const state = "before" as JoinState;

  return (
    <>
      <PageBanner title="Join online" crumb="Join online" />
      <div className="container-content py-14">
        {state === "before" && (
          <div className="mx-auto max-w-[480px] text-center">
            <p className="mono text-[13px] uppercase tracking-wider text-muted">Session opens</p>
            <p className="mono mt-3 text-[34px] text-ink">{event.date}</p>
            <p className="mt-4 text-[15px] text-muted">
              The join link opens 30 minutes before start time.
            </p>
            <button type="button" className="btn-secondary mt-6">Add to calendar</button>
          </div>
        )}

        {state === "open" && <PasscodeGate cta="Open meeting" />}

        {state === "after" && (
          <p className="text-center text-[17px] text-muted">This session has ended.</p>
        )}
      </div>
    </>
  );
}
