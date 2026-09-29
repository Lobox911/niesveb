"use client";
import { useState } from "react";
import PasscodeGate, { type Verified } from "@/components/PasscodeGate";
import CredentialStrip from "@/components/CredentialStrip";

export default function CertificateGate() {
  const [r, setR] = useState<Verified | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the PDF and hands it to the browser as a download.
   *
   * A plain link would have to carry the passcode in the URL, which puts it in
   * history and in anything the participant pastes to a colleague.
   */
  const download = async (passcode: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "The certificate could not be produced. Try again shortly.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "certificate.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick: revoking immediately cancels the download in
      // some browsers before it has started reading the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("The download did not start. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

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
          <button
            type="button"
            className="btn-primary mt-5 min-h-[50px] px-8 disabled:opacity-60"
            disabled={busy}
            onClick={() => void download(r.passcode!)}
          >
            {busy ? "Preparing your certificate" : "Download certificate (PDF)"}
          </button>
          <p className="help">
            A4 landscape. It carries a serial number and a QR code anyone can
            scan to confirm it is genuine.
          </p>
          {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}