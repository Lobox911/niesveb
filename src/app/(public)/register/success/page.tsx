import type { Metadata } from "next";
import Link from "next/link";
import CredentialStrip from "@/components/CredentialStrip";
import CopyButton from "@/components/CopyButton";

export const metadata: Metadata = { title: "Registration received" };

// TODO: read the issued registration from the database by session/token.
const MOCK = { code: "EBY4-9K7C", name: "Adenuga Oluwaseun", category: "Member", mode: "Virtual" };

export default function SuccessPage() {
  return (
    <div className="container-content py-16">
      <div className="mx-auto max-w-[560px]">
        <h1 className="text-center text-[26px]">Registration received</h1>
        <p className="mt-3 text-center text-[15px] text-muted">
          Your details have been recorded. Save your passcode.
        </p>

        <div className="mt-10">
          <CredentialStrip
            code={MOCK.code}
            rows={[
              { label: "Participant", value: MOCK.name },
              { label: "Category", value: MOCK.category },
              { label: "Mode", value: MOCK.mode },
            ]}
          />
        </div>

        <p className="mono mt-6 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-gold">
          Payment pending confirmation
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <CopyButton value={MOCK.code} label="Copy passcode" className="btn-primary" />
          <button type="button" className="btn-secondary">Download as PDF</button>
          <button type="button" className="btn-secondary">Send to my email again</button>
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <h2 className="text-[20px]">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {[
              "Payment is confirmed by the branch within 24 hours. Until then the passcode works for the photo card but not for the certificate.",
              "Virtual participants use the passcode on the Join online page from 30 minutes before start time.",
              "The e-certificate opens after attendance is marked on the seminar day.",
            ].map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="mono shrink-0 text-[14px] text-gold">{i + 1}.</span>
                <span className="text-[15px] leading-relaxed text-muted">{t}</span>
              </li>
            ))}
          </ol>
          <Link href="/join" className="btn-secondary mt-8">Go to Join online</Link>
        </div>
      </div>
    </div>
  );
}
