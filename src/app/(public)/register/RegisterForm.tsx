"use client";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { submitRegistration } from "../actions";
import FileUpload from "@/components/FileUpload";

type Category = {
  id: string;
  key: string;
  name: string;
  eligibility: string;
  fee: number;
  feeLabel: string;
  units: number;
  requiresMembershipNo: boolean;
};

const TITLES = ["Esv.", "Mr", "Mrs", "Dr", "Prof", "Arc.", "Engr."];

/**
 * One page, one form.
 *
 * The earlier version was a column of seven fee cards followed by a second
 * page of fields. It read like a SaaS pricing table — the wrong register
 * entirely for a chartered body. A select plus a compact form is what people
 * filling in a professional registration expect, and the fee schedule already
 * sits on the home page for anyone comparing.
 */
export default function RegisterForm({
  categories, venue, preselect,
}: { categories: Category[]; venue: string; preselect?: string }) {
  const [state, action, pending] = useActionState(
    submitRegistration,
    null as { error?: string; duplicate?: boolean } | null,
  );
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.key === preselect)?.id ?? "",
  );
  const [mode, setMode] = useState<"physical" | "virtual">("physical");
  const [proofUrl, setProofUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const chosen = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  const checkBeforeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};

    if (!categoryId) next.categoryId = "Select your participation category.";
    if (!String(fd.get("surname") || "").trim()) next.surname = "Enter your surname.";
    if (!String(fd.get("firstName") || "").trim()) next.firstName = "Enter your first name.";

    const email = String(fd.get("email") || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      next.email = "Enter a valid email address. Your passcode and certificate are sent here.";
    }

    const phone = String(fd.get("phone") || "").replace(/\D/g, "");
    if (phone.length !== 11) next.phone = "Enter an 11-digit phone number.";

    if (chosen?.requiresMembershipNo && !String(fd.get("membershipNo") || "").trim()) {
      next.membershipNo = "Enter your NIESV membership number.";
    }
    if (!proofUrl) {
      next.proofUrl = "Attach the teller or receipt for your payment. Wait for it to finish uploading.";
    }

    setErrors(next);
    if (Object.keys(next).length) {
      e.preventDefault();
      document.getElementById("error-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const Err = ({ name }: { name: string }) =>
    errors[name] ? (
      <p id={`${name}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form action={action} onSubmit={checkBeforeSubmit} noValidate className="mt-12 max-w-[560px]">
      {state?.error && (
        <div className="mb-8 rounded border border-danger bg-white p-4">
          <p role="alert" className="text-[15px] text-danger">{state.error}</p>
          {state.duplicate && (
            <Link href="/retrieve" className="btn-secondary mt-4">Retrieve my code</Link>
          )}
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div id="error-summary" className="mb-8 rounded border border-danger bg-white p-4">
          <h3 className="text-[17px] text-danger">Check these fields</h3>
          <ul className="mt-2 space-y-1">
            {Object.entries(errors).map(([k, v]) => (
              <li key={k}>
                <a href={`#${k}`} className="text-[14px] text-danger underline">{v}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="categoryId">Participation category</label>
          <select
            id="categoryId" name="categoryId" className="field"
            value={categoryId}
            aria-invalid={!!errors.categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setErrors({}); }}
          >
            <option value="">Select your category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.feeLabel}
              </option>
            ))}
          </select>
          {chosen && (
            <p className="help">
              {chosen.eligibility}. {chosen.units} MCPD units.
            </p>
          )}
          <Err name="categoryId" />
        </div>

        <div>
          <label className="label" htmlFor="mode">Attendance</label>
          <select
            id="mode" name="mode" className="field" value={mode}
            onChange={(e) => setMode(e.target.value as "physical" | "virtual")}
          >
            <option value="physical">Physical</option>
            <option value="virtual">Virtual</option>
          </select>
          <p className="help">
            {mode === "physical" ? venue : "A join link is issued with your passcode."}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <select id="title" name="title" className="field">
              {TITLES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="surname">Surname</label>
            <input id="surname" name="surname" className="field"
              aria-invalid={!!errors.surname} placeholder="Example: Okafor" />
            <Err name="surname" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" className="field"
            aria-invalid={!!errors.firstName} placeholder="Example: Chinedu" />
          <Err name="firstName" />
        </div>

        <div>
          <label className="label" htmlFor="otherNames">Other names</label>
          <input id="otherNames" name="otherNames" className="field" />
        </div>

        {chosen?.requiresMembershipNo && (
          <div>
            <label className="label" htmlFor="membershipNo">NIESV membership number</label>
            <input id="membershipNo" name="membershipNo" className="field-mono"
              aria-invalid={!!errors.membershipNo}
              placeholder="Example FL01008, G07854, M02598" />
            <Err name="membershipNo" />
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" className="field"
            aria-invalid={!!errors.email} placeholder="Example: c.okafor@firm.com.ng" />
          <Err name="email" />
        </div>

        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" name="phone" inputMode="numeric" className="field-mono"
            aria-invalid={!!errors.phone} placeholder="Example 08031234567" />
          <Err name="phone" />
        </div>

        <div id="proofUrl">
          <FileUpload
            name="proofUrl"
            label="Attach your teller or receipt"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            folder="proofs"
            maxMb={5}
            help="A photograph or PDF of the teller, transfer receipt or bank alert. JPG, PNG, WebP or PDF, up to 5MB. It uploads as soon as you choose it."
            onUploaded={(url) => { setProofUrl(url); setErrors((e) => { const { proofUrl: _drop, ...rest } = e; return rest; }); }}
          />
          <Err name="proofUrl" />
        </div>

        <div>
          <label className="label" htmlFor="amount">Amount paid</label>
          <input id="amount" name="amount" inputMode="numeric" className="field-mono"
            value={chosen ? chosen.fee : ""} readOnly />
          <p className="help">Set by your category.</p>
        </div>

        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" name="consent" className="mt-1" />
          <span>My name may appear in the published participants list.</span>
        </label>
      </div>

      <button type="submit" disabled={pending}
        className="btn-primary mt-8 min-h-[50px] px-8 disabled:opacity-60">
        {pending ? "Submitting" : "Submit registration"}
      </button>
    </form>
  );
}