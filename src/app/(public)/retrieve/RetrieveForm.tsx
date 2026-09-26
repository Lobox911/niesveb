"use client";
import Link from "next/link";
import { useActionState } from "react";
import CredentialStrip from "@/components/CredentialStrip";
import { retrievePasscode } from "../actions";

type Result = {
  ok?: boolean; error?: string;
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