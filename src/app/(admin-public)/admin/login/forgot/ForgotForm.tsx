"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../reset-actions";

export default function ForgotForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    null as { ok?: boolean; error?: string } | null,
  );

  /* Deliberately the same message whether or not the address matched. Telling
     a stranger "no such account" would let them work out which addresses
     belong to branch officers. */
  if (state?.ok) {
    return (
      <div className="card mt-8 p-6">
        <h2 className="text-[18px] text-ink">Check your inbox</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          If that address belongs to an active officer account, a link to set a
          new password is on its way. It works once and expires in an hour.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Nothing arrived? Check the spam folder, then ask the branch
          administrator to reset it for you from the Users screen.
        </p>
        <Link href="/admin/login" className="btn-secondary mt-6 min-h-[46px] w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="card mt-8 p-6">
      {state?.error && (
        <p role="alert" className="mb-4 rounded border border-danger bg-white p-3 text-[14px] text-danger">
          {state.error}
        </p>
      )}

      <label className="label" htmlFor="email">Official email address</label>
      <input id="email" name="email" type="email" autoComplete="username" className="field" required />

      <button type="submit" disabled={pending} className="btn-primary mt-6 min-h-[48px] w-full disabled:opacity-60">
        {pending ? "Sending" : "Send the link"}
      </button>

      <Link href="/admin/login" className="mt-5 block text-center text-[14px] text-green underline underline-offset-4">
        Back to sign in
      </Link>
    </form>
  );
}