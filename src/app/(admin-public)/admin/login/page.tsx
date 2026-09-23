import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Officer sign in", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="container-content flex min-h-screen items-center justify-center py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[26px] text-ink">Officer sign in</h1>
          <p className="mt-2 text-[15px] text-muted">
            For NIESV Ebonyi branch officers. Every sign in is recorded.
          </p>
          <LoginForm />
          <Link href="/" className="mt-8 inline-block text-[14px] text-green underline underline-offset-4">
            Return to the public site
          </Link>
        </div>
      </div>
    </div>
  );
}
