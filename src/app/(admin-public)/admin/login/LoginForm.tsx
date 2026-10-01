"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  const [reveal, setReveal] = useState(false);

  return (
    <form action={action} className="card mt-8 p-6">
      {state?.error && (
        <p role="alert" className="mb-4 rounded border border-danger bg-white p-3 text-[14px] text-danger">
          {state.error}
        </p>
      )}

      <label className="label" htmlFor="email">Official email address</label>
      <input id="email" name="email" type="email" autoComplete="username" className="field" required />

      <label className="label mt-4" htmlFor="password">Password</label>
      <div className="relative">
        <input
          id="password"
          name="password"
          /* Toggling the type rather than rendering two inputs: a second field
             would be a second thing for a password manager to fill, and it
             fills the wrong one often enough to be a nuisance. */
          type={reveal ? "text" : "password"}
          autoComplete="current-password"
          className="field pr-[76px]"
          required
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
      <p className="help">
        Check what you typed before signing in — a wrong password is the most
        common reason a sign in fails.
      </p>

      <button type="submit" disabled={pending} className="btn-primary mt-6 min-h-[48px] w-full disabled:opacity-60">
        {pending ? "Signing in" : "Sign in"}
      </button>

      <div className="mt-5 border-t border-line pt-4">
        <Link
          href="/admin/login/forgot"
          className="text-[14px] text-green underline underline-offset-4"
        >
          Forgotten your password?
        </Link>
        <p className="help mt-3">
          Accounts are created by the branch administrator. There is no self
          signup.
        </p>
      </div>
    </form>
  );
}