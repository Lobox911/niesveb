"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { completePasswordReset } from "../reset-actions";

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    completePasswordReset,
    null as { ok?: boolean; error?: string } | null,
  );
  const [reveal, setReveal] = useState(false);

  if (state?.ok) {
    return (
      <div className="card mt-8 p-6">
        <h2 className="text-[18px] text-ink">Password changed</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Sign in with your new password. The link you used has now been spent.
        </p>
        <Link href="/admin/login" className="btn-primary mt-6 min-h-[46px] w-full">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="card mt-8 p-6">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <p role="alert" className="mb-4 rounded border border-danger bg-white p-3 text-[14px] text-danger">
          {state.error}
        </p>
      )}

      <label className="label" htmlFor="password">New password</label>
      <div className="relative">
        <input
          id="password" name="password"
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          className="field pr-[76px]" required minLength={10}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-pressed={reveal}
          className="absolute inset-y-0 right-0 px-3 text-[13px] font-medium text-muted hover:text-ink"
        >
          {reveal ? "Hide" : "Show"}
        </button>
      </div>
      <p className="help">At least 10 characters.</p>

      <label className="label mt-4" htmlFor="confirm">Repeat it</label>
      <input
        id="confirm" name="confirm"
        type={reveal ? "text" : "password"}
        autoComplete="new-password"
        className="field" required minLength={10}
      />

      <button type="submit" disabled={pending} className="btn-primary mt-6 min-h-[48px] w-full disabled:opacity-60">
        {pending ? "Saving" : "Save my new password"}
      </button>
    </form>
  );
}