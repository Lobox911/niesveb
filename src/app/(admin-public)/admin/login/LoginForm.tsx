"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

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
      <input id="password" name="password" type="password" autoComplete="current-password" className="field" required />

      <button type="submit" disabled={pending} className="btn-primary mt-6 w-full disabled:opacity-60">
        {pending ? "Signing in" : "Sign in"}
      </button>

      <p className="help mt-4">
        Accounts are created by the branch administrator. There is no self signup.
      </p>
    </form>
  );
}