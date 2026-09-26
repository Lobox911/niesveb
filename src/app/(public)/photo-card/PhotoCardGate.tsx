"use client";
import { useState } from "react";
import PasscodeGate, { type Verified } from "@/components/PasscodeGate";
import CredentialStrip from "@/components/CredentialStrip";

export default function PhotoCardGate() {
  const [r, setR] = useState<Verified | null>(null);

  if (!r) return <PasscodeGate cta="Continue" onVerified={setR} />;

  return (
    <div className="max-w-[560px]">
      <CredentialStrip
        code={r.passcode!}
        rows={[
          { label: "Participant", value: r.name! },
          { label: "Category", value: r.category! },
          { label: "Mode", value: r.mode! },
        ]}
      />

      {/* Deliberately not gated on payment: the photo card is the one thing a
          participant can do immediately, and withholding it while the branch
          works through bank receipts creates support calls for no benefit. */}
      <div className="mt-8">
        <p className="text-[15px] leading-relaxed text-muted">
          Upload a portrait to generate your participant card. Face centred,
          plain background, shoulders visible.
        </p>
        {/* TODO: upload → crop → CR80 card preview → PNG and print PDF */}
        <button type="button" className="btn-primary mt-5 min-h-[50px] px-8" disabled>
          Upload a photo
        </button>
        <p className="help">Photo card generation is being finalised.</p>
      </div>
    </div>
  );
}