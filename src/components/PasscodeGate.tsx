"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { verifyPasscode } from "@/app/(public)/actions";

export type Verified = Awaited<ReturnType<typeof verifyPasscode>> & { ok?: true };

/**
 * Shared gate for the photo card, join and certificate pages. It only
 * establishes who the code belongs to; each page decides what that person is
 * allowed to do, because the rules differ — a photo card needs only a
 * registration, a certificate needs confirmed payment and attendance.
 */
export default function PasscodeGate({
  cta = "Continue",
  label = "Registration code",
  onVerified,
}: {
  cta?: string;
  label?: string;
  onVerified: (result: Verified) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const format = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
  };

  const submit = () =>
    start(async () => {
      const res = await verifyPasscode(code);
      if ("error" in res && res.error) { setError(res.error); return; }
      setError(null);
      onVerified(res as Verified);
    });

  return (
    <div className="max-w-[480px]">
      <label className="label" htmlFor="passcode">{label}</label>
      <input
        id="passcode"
        className="field-mono text-[20px] tracking-[0.18em]"
        value={code}
        placeholder="Example EBY4-9K7C"
        autoComplete="off"
        aria-describedby="passcode-help"
        onChange={(e) => { setCode(format(e.target.value)); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <p id="passcode-help" className="help">
        Eight characters, issued when you registered.
      </p>

      {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}

      <button type="button" onClick={submit} disabled={pending || code.length < 9}
        className="btn-primary mt-5 min-h-[50px] px-8 disabled:opacity-40">
        {pending ? "Checking" : cta}
      </button>

      <p className="help mt-4">
        Lost it? <Link href="/retrieve" className="text-green underline underline-offset-4">Retrieve your code</Link>.
      </p>
    </div>
  );
}