"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { event, formatNaira } from "@/lib/event";

const TITLES = ["Esv.", "Mr", "Mrs", "Dr", "Prof", "Arc.", "Engr."];
const NIESV_CATS = ["fellows", "members", "graduates", "niesv-students"];

export default function DetailsForm({
  category, mode,
}: { category?: string; mode?: string }) {
  const router = useRouter();
  const chosen = event.categories.find((c) => c.id === category);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    if (!String(fd.get("surname") || "").trim()) next.surname = "Enter your surname as it appears on your NIESV record.";
    if (!String(fd.get("firstName") || "").trim()) next.firstName = "Enter your first name.";
    const email = String(fd.get("email") || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = "Enter a valid email address. Your passcode and certificate are sent here.";
    const phone = String(fd.get("phone") || "").replace(/\D/g, "");
    if (phone.length !== 11) next.phone = "Enter an 11-digit Nigerian phone number.";
    if (!String(fd.get("txnRef") || "").trim()) next.txnRef = "Enter the transaction reference or teller number from your payment.";

    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById("error-summary")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setBusy(true);
    // TODO: POST to /api/registrations, then redirect with the issued passcode.
    router.push("/register/success");
  };

  const Err = ({ name }: { name: string }) =>
    errors[name] ? <p className="mt-1.5 text-[13px] text-danger" role="alert">{errors[name]}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-[560px]">
      <div className="rounded bg-paper border border-line p-4">
        <dl className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
          <div>
            <dt className="text-muted">Category</dt>
            <dd className="text-ink">{chosen?.name ?? "Not selected"}</dd>
          </div>
          <div>
            <dt className="text-muted">Mode</dt>
            <dd className="capitalize text-ink">{mode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Fee</dt>
            <dd className="mono text-ink">{chosen ? formatNaira(chosen.fee) : "—"}</dd>
          </div>
        </dl>
        <Link href="/register" className="mt-3 inline-block text-[14px] text-green underline underline-offset-4">
          Change
        </Link>
      </div>

      {Object.keys(errors).length > 0 && (
        <div id="error-summary" className="mt-6 rounded border border-danger bg-white p-4">
          <h2 className="text-[17px] text-danger">Check these fields</h2>
          <ul className="mt-2 space-y-1">
            {Object.entries(errors).map(([k, v]) => (
              <li key={k}><a href={`#${k}`} className="text-[14px] text-danger underline">{v}</a></li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="mt-8">
        <legend className="mono text-[12px] uppercase tracking-wider text-muted">Identity</legend>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <select id="title" name="title" className="field">
              {TITLES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="surname">Surname</label>
            <input id="surname" name="surname" className="field" aria-invalid={!!errors.surname} />
            <Err name="surname" />
          </div>
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" className="field" aria-invalid={!!errors.firstName} />
            <Err name="firstName" />
          </div>
          {category && NIESV_CATS.includes(category) && (
            <div>
              <label className="label" htmlFor="membershipNo">NIESV membership number</label>
              <input id="membershipNo" name="membershipNo" className="field-mono" />
              <p className="help">As printed on your NIESV identity card.</p>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="mt-8 border-t border-line pt-8">
        <legend className="mono text-[12px] uppercase tracking-wider text-muted">Contact</legend>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="field" aria-invalid={!!errors.email} />
            <p className="help">Your passcode and e-certificate are sent to this address.</p>
            <Err name="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" inputMode="numeric" className="field-mono" aria-invalid={!!errors.phone} />
            <p className="help">11 digits, for example 08031234567.</p>
            <Err name="phone" />
          </div>
          <div>
            <label className="label" htmlFor="firm">Firm or organisation</label>
            <input id="firm" name="firm" className="field" />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-8 border-t border-line pt-8">
        <legend className="mono text-[12px] uppercase tracking-wider text-muted">Payment evidence</legend>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="txnRef">Transaction reference or teller number</label>
            <input id="txnRef" name="txnRef" className="field-mono" aria-invalid={!!errors.txnRef} />
            <Err name="txnRef" />
          </div>
          <div>
            <label className="label" htmlFor="amount">Amount paid</label>
            <input id="amount" name="amount" className="field-mono" defaultValue={chosen?.fee ?? ""} inputMode="numeric" />
          </div>
          <div>
            <label className="label" htmlFor="proof">Proof of payment</label>
            <input id="proof" name="proof" type="file" accept=".jpg,.jpeg,.png,.pdf" className="field py-2.5" />
            <p className="help">JPG, PNG or PDF. Maximum 5MB.</p>
          </div>
        </div>
      </fieldset>

      <div className="mt-8 border-t border-line pt-6">
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" name="consent" className="mt-1" />
          <span>My name and firm may appear in the published participants list.</span>
        </label>
      </div>

      <button type="submit" disabled={busy} className="btn-primary mt-8 w-full disabled:opacity-60">
        {busy ? "Submitting" : "Complete registration"}
      </button>
    </form>
  );
}
