"use client";
import { useState } from "react";

/**
 * Shared passcode entry used by photo-card, join and certificate.
 * Auto-hyphenates after the 4th character. Error copy names the fix
 * rather than saying "invalid".
 */
export default function PasscodeGate({
  onSubmit, cta = "Continue",
}: { onSubmit?: (code: string) => void; cta?: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const format = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
  };

  return (
    <div className="card mx-auto max-w-[480px] p-6">
      <label className="label" htmlFor="passcode">Registration passcode</label>
      <input
        id="passcode"
        className="field-mono text-[20px] tracking-[0.18em]"
        value={code}
        placeholder="EBY4-9K7C"
        autoComplete="off"
        aria-describedby="passcode-help"
        onChange={(e) => { setCode(format(e.target.value)); setError(null); }}
      />
      <p id="passcode-help" className="help">
        Eight characters, sent to you by email and SMS when you registered.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>
      )}

      <button
        type="button"
        className="btn-primary mt-4 w-full"
        onClick={() => {
          if (code.replace("-", "").length < 8) {
            setError("That passcode is incomplete. It has eight characters, for example EBY4-9K7C.");
            return;
          }
          onSubmit?.(code);
        }}
      >
        {cta}
      </button>

      <p className="help mt-4">
        Lost it? <a className="text-green underline underline-offset-4" href="/retrieve">Retrieve your passcode</a>.
      </p>
    </div>
  );
}
