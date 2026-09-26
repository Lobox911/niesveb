"use client";
import Link from "next/link";
import { useActionState } from "react";
import CredentialStrip from "@/components/CredentialStrip";
import { retrievePasscode } from "../actions";

type Result = {
  ok?: boolean; error?: string;
  pending?: boolean; status?: "pending" | "rejected"; reason?: string;
  passcode?: string; name?: string; email?: string;
  category?: string; eventTitle?: string;
};

export default function RetrieveForm() {
  const [state, action, pending] = useActionState(retrievePasscode, null as Result | null);

  if (state?.ok && state.passcode) {
    return (
      <div className="max-w-[480px]">
        <CredentialStrip
          code={state.passcode}
          rows={[
            { label: "Participant", value: state.name ?? "" },
            { label: "Email", value: state.email ?? "" },
            { label: "Category", value: state.category ?? "" },
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/photo-card" className="btn-secondary">Photo card</Link>
          <Link href="/certificate" className="btn-secondary">Certificate</Link>
        </div>
      </div>
    );
  }

  /**
   * A registration exists but has no code yet. Saying "not found" here is what
   * makes people register a second time, and the branch then has two rows and
   * one payment to reconcile.
   */
  if (state?.pending && state.status === "pending") {
    return (
      <div className="max-w-[480px]">
        <div className="card p-6">
          <p className="mono inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-gold">
            Payment awaiting confirmation
          </p>
          <h2 className="mt-4 text-[20px]">You are registered</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {state.name}, your registration for {state.eventTitle} has been
            recorded. The branch is still checking your payment, so your
            participation code has not been issued yet.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            It will be emailed to {state.email} as soon as the payment is
            confirmed. There is no need to register again.
          </p>
        </div>
      </div>
    );
  }

  if (state?.pending && state.status === "rejected") {
    return (
      <div className="max-w-[480px]">
        <div className="card border-danger p-6">
          <p className="mono inline-flex rounded border border-danger/40 bg-danger/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-danger">
            Payment not confirmed
          </p>
          <h2 className="mt-4 text-[20px]">Your payment could not be confirmed</h2>
          {state.reason && (
            <p className="mt-3 border-l-2 border-gold bg-paper p-4 text-[15px] leading-relaxed text-ink">
              {state.reason}
            </p>
          )}
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Your registration is held, not cancelled. Contact the branch to
            resolve this and your code will be issued once the payment is
            confirmed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-[480px]">
      <label className="label" htmlFor="q">Membership number or email</label>
      <input id="q" name="q" className="field-mono" aria-describedby="q-help"
        placeholder="Example FL01008, G07854, M02598" />
      <p id="q-help" className="help">Either one works.</p>

      {state?.error && (
        <div className="mt-4 rounded border border-line bg-paper p-4">
          <p role="alert" className="text-[15px] text-ink">{state.error}</p>
          <Link href="/register" className="btn-primary mt-4">Register now</Link>
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary mt-5 min-h-[50px] px-8 disabled:opacity-60">
        {pending ? "Searching" : "Find my registration"}
      </button>
    </form>
  );
}