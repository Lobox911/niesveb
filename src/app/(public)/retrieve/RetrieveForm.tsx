"use client";
import Link from "next/link";
import { useState } from "react";
import CredentialStrip from "@/components/CredentialStrip";

export default function RetrieveForm() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"idle" | "found" | "none">("idle");

  return (
    <div className="max-w-[480px]">
      {state !== "found" && (
        <div>
          <label className="label" htmlFor="q">Membership number or email</label>
          <input
            id="q" className="field-mono" value={q} placeholder="Example FL01008, G07854, M02598"
            onChange={(e) => { setQ(e.target.value); setState("idle"); }}
            aria-describedby="q-help"
          />
          <p id="q-help" className="help">Either one works.</p>
          <button
            type="button"
            className="btn-primary mt-5 min-h-[50px] px-8"
            onClick={() => setState(q.trim() ? "found" : "none")}
          >
            Find my registration
          </button>
        </div>
      )}

      {state === "found" && (
        <>
          <CredentialStrip
            code="EBY4-9K7C"
            rows={[
              { label: "Participant", value: "Adenuga Oluwaseun" },
              { label: "Email", value: "o***@gmail.com" },
              { label: "Category", value: "Member" },
            ]}
          />
          <button type="button" className="btn-secondary mt-6 w-full" onClick={() => setState("idle")}>
            Search again
          </button>
        </>
      )}

      {state === "none" && (
        <div className="mt-6 rounded border border-line bg-paper p-5">
          <p className="text-[15px] text-ink">
            No 2026 registration found for that membership number.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Register now</Link>
          </div>
        </div>
      )}
    </div>
  );
}