import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";
import ResetForm from "./ResetForm";
import { checkResetToken } from "../reset-actions";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const check = await checkResetToken(token ?? "");

  // Checked before rendering the form, so a dead link says so immediately
  // rather than after somebody has chosen and typed a new password twice.
  if (!check.valid) {
    return (
      <AuthShell
        heading="This link no longer works"
        intro="Reset links work once and expire after an hour."
      >
        <div className="card mt-8 p-6">
          <p className="text-[15px] leading-relaxed text-muted">
            Request a new one, or ask the branch administrator to reset your
            password from the Users screen.
          </p>
          <Link href="/admin/login/forgot" className="btn-primary mt-6 min-h-[46px] w-full">
            Request a new link
          </Link>
          <Link href="/admin/login" className="mt-4 block text-center text-[14px] text-green underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Set a new password"
      intro={`Welcome back, ${check.name}. Choose a password you have not used elsewhere.`}
    >
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}