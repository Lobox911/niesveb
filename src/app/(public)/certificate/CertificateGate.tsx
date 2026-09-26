"use client";
import { useState } from "react";
import PasscodeGate, { type Verified } from "@/components/PasscodeGate";
import CredentialStrip from "@/components/CredentialStrip";

export default function CertificateGate() {
  const [r, setR] = useState<Verified | null>(null);

  if (!r) return <PasscodeGate cta="Open my certificate" onVerified={setR} />;

  /* Each refusal names the actual obstacle. A single "not eligible" message
     turns into a phone call; "your payment is not confirmed yet" does not. */
  const blocked =
    r.status === "rejected"
      ? "Your payment was not accepted by the branch. Please contact the branch to resolve this."
      : r.status !== "confirmed"
        ? "Your payment is still being confirmed by the branch. Your certificate opens once it is."
        : !r.attended
          ? "We have no attendance record against this code. Physical participants must sign the attendance register at the venue; virtual participants are marked during the session."
          : r.eventStatus === "open" && new Date(r.startsAt!) > new Date()
            ? "Certificates open after the seminar has taken place."
            : null;

  return (
    <div className="max-w-[560px]">
      <CredentialStrip
        code={r.passcode!}
        label="Registration code"
        rows={[
          { label: "Participant", value: r.name! },
          { label: "Category", value: r.category! },
          { label: "Credit points", value: String(r.units ?? "") },
        ]}
      />

      {blocked ? (
        <div className="mt-8 rounded border border-line bg-paper p-5">
          <p className="text-[15px] leading-relaxed text-ink">{blocked}</p>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-[15px] text-muted">
            Your certificate is ready.
            {r.certificateSerial && (
              <> Serial <span className="mono text-ink">{r.certificateSerial}</span>.</>
            )}
          </p>
          {/* TODO: server-rendered PDF at print resolution */}
          <button type="button" className="btn-primary mt-5 min-h-[50px] px-8" disabled>
            Download certificate (PDF)
          </button>
          <p className="help">Certificate generation is being finalised.</p>
        </div>
      )}
    </div>
  );
}