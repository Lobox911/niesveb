import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CredentialStrip from "@/components/CredentialStrip";
import CopyButton from "@/components/CopyButton";
import { getReceipt } from "../../actions";
import { emailEnabled } from "@/lib/email";
import { naira } from "@/lib/site";

export const metadata: Metadata = { title: "Registration received", robots: { index: false } };

export default async function SuccessPage() {
  const r = await getReceipt();
  // Nothing to show without the receipt cookie — usually a refresh long after
  // registering, or a direct visit.
  if (!r) redirect("/retrieve");

  const name = `${r.title ?? ""} ${r.firstName} ${r.surname}`.trim();
  const mailed = emailEnabled();
  const [user, domain] = r.email.split("@");

  return (
    <div className="container-content py-16">
      <div className="mx-auto max-w-[560px]">
        <h1 className="text-center text-[26px]">Registration received</h1>
        <p className="mt-3 text-center text-[15px] text-muted">
          Your details have been recorded. Save your code.
        </p>

        <div className="mt-10">
          <CredentialStrip
            code={r.passcode}
            rows={[
              { label: "Participant", value: name },
              { label: "Category", value: r.categoryName },
              { label: "Mode", value: r.mode },
              { label: "Amount", value: naira(r.amountKobo) },
            ]}
          />
        </div>

        <p className="mono mt-6 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-gold">
          Payment pending confirmation
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <CopyButton value={r.passcode} label="Copy code" className="btn-primary" />
          <Link href="/photo-card" className="btn-secondary">Make my photo card</Link>
        </div>

        <p className="help mt-4">
          {mailed
            ? `A copy has been emailed to ${user.slice(0, 1)}***@${domain}. If it has not arrived in a few minutes, check your spam folder.`
            : "Write this code down now. You can retrieve it at any time using your membership number or email address."}
        </p>

        <div className="mt-12 border-t border-line pt-8">
          <h2 className="text-[20px]">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {[
              "The branch confirms your payment against the bank record. Until then your code works for the photo card but not the certificate.",
              "Virtual participants use this code on the Join online page from 30 minutes before start time.",
              "Your e-certificate opens after the seminar, once attendance has been recorded.",
            ].map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="mono shrink-0 text-[14px] text-gold">{i + 1}.</span>
                <span className="text-[15px] leading-relaxed text-muted">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}