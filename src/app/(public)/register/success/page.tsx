import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getReceipt } from "../../actions";
import { emailEnabled } from "@/lib/email";
import { naira, getBranch } from "@/lib/site";

export const metadata: Metadata = { title: "Registration received", robots: { index: false } };

/**
 * No code on this page.
 *
 * The passcode opens the join link, the photo card and the attendance gate,
 * so it is issued when an officer confirms the payment — not when the form is
 * submitted. What this page owes the participant instead is certainty that
 * the registration landed, and a clear statement of what happens next.
 */
export default async function SuccessPage() {
  const [r, branch] = await Promise.all([getReceipt(), getBranch()]);

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
          Your details have been recorded. Your participation code follows once
          the branch has confirmed your payment.
        </p>

        <dl className="card mt-10 divide-y divide-line">
          {[
            ["Participant", name],
            ["Event", r.eventTitle],
            ["Category", r.categoryName],
            ["Attendance", r.mode === "virtual" ? "Virtual" : "Physical"],
            ["Fee", naira(r.amountKobo)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 px-5 py-3.5">
              <dt className="text-[14px] text-muted">{label}</dt>
              <dd className="text-right text-[15px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mono mt-6 inline-flex rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-gold">
          Payment awaiting confirmation
        </p>

        {mailed && (
          <p className="help mt-4">
            A confirmation of this registration has been sent to{" "}
            {user.slice(0, 1)}***@{domain}. Your participation code arrives in a
            second email once the payment is confirmed. If neither arrives,
            check your spam folder.
          </p>
        )}

        <div className="mt-12 border-t border-line pt-8">
          <h2 className="text-[20px]">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {[
              "The branch checks your payment against the bank record.",
              "Once confirmed, your participation code is emailed to you. That code is what opens the join link, your photo card and your certificate.",
              "Your certificate becomes available after the seminar, when your attendance has been recorded.",
            ].map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="mono shrink-0 text-[14px] text-gold">{i + 1}.</span>
                <span className="text-[15px] leading-relaxed text-muted">{t}</span>
              </li>
            ))}
          </ol>
          <p className="help mt-5">
            Nothing is required from you in the meantime. You can check the
            status of your registration at any time on the{" "}
            <Link href="/retrieve" className="text-green underline underline-offset-4">
              retrieve code
            </Link>{" "}
            page.
          </p>
        </div>

        {/* Repeated deliberately. A fair number of people submit the form
            before they have actually transferred the money. */}
        {branch.accountNumber && (
          <div className="card mt-10 p-6">
            <h2 className="text-[17px]">If you have not paid yet</h2>
            <p className="mt-2 text-[15px] text-muted">
              Transfer {naira(r.amountKobo)} to the branch account, then send
              the receipt to the branch.
            </p>
            <dl className="mt-4 space-y-1.5">
              <div className="flex justify-between gap-6">
                <dt className="text-[14px] text-muted">Bank</dt>
                <dd className="text-[15px] text-ink">{branch.bankName}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[14px] text-muted">Account name</dt>
                <dd className="text-right text-[15px] text-ink">{branch.accountName}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[14px] text-muted">Account number</dt>
                <dd className="mono select-all text-[17px] text-ink">{branch.accountNumber}</dd>
              </div>
            </dl>
            {branch.contactPhones.length > 0 && (
              <p className="help mt-4">
                Questions: {branch.contactPhones.join(" · ")}
                {branch.contactEmail ? ` · ${branch.contactEmail}` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}