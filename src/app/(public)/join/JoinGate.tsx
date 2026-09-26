"use client";
import { useState } from "react";
import PasscodeGate, { type Verified } from "@/components/PasscodeGate";
import CopyButton from "@/components/CopyButton";

export default function JoinGate() {
  const [r, setR] = useState<Verified | null>(null);

  if (!r) return <PasscodeGate cta="Open the session" onVerified={setR} />;

  if (r.status !== "confirmed") {
    return (
      <div className="max-w-[560px] rounded border border-line bg-paper p-5">
        <p className="text-[15px] leading-relaxed text-ink">
          {r.name}, your payment is still being confirmed by the branch. The
          join link opens once it is.
        </p>
      </div>
    );
  }

  if (!r.meetingUrl) {
    return (
      <div className="max-w-[560px] rounded border border-line bg-paper p-5">
        <p className="text-[15px] leading-relaxed text-ink">
          The meeting link has not been published yet. It appears here closer to
          the seminar.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <p className="text-[15px] text-muted">Welcome, {r.name}.</p>
      <a href={r.meetingUrl} target="_blank" rel="noreferrer"
        className="btn-primary mt-5 min-h-[54px] px-8 text-[16px]">
        Open meeting
      </a>

      {/* The raw link as selectable text, because a redirect blocked by an
          in-app browser otherwise leaves the participant with nothing. */}
      <div className="mt-8 border-t border-line pt-5">
        <p className="mono text-[12px] uppercase tracking-wider text-muted">Meeting link</p>
        <p className="mono mt-1 select-all break-all text-[14px] text-ink">{r.meetingUrl}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <CopyButton value={r.meetingUrl} label="Copy link" />
          {r.meetingId && (
            <span className="mono text-[14px] text-muted">ID {r.meetingId}</span>
          )}
        </div>
      </div>
    </div>
  );
}