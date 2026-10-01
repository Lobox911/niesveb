import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { getBranch } from "@/lib/site";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The sign-in page carries the branch's own hero image, blurred.
 *
 * Blurred rather than sharp on purpose: this image was chosen for the home
 * page hero, where it sits behind a headline. Behind a form it would compete
 * with the fields. Blur plus a dark wash turns it into texture that says whose
 * site this is without making the inputs harder to read.
 *
 * With no image uploaded the page falls back to solid ink, which is a
 * perfectly good sign-in page rather than a broken one.
 */
export default async function AdminLoginPage() {
  const branch = await getBranch();
  const backdrop = branch.heroImageUrl || branch.bannerImageUrl;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
      {backdrop && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdrop}
            alt=""
            aria-hidden
            /* scale-110 hides the soft transparent edge that blur leaves
               around the bounds of the image. */
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />
          <div className="absolute inset-0 bg-ink/75" aria-hidden />
        </>
      )}

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Centred as a block: crest, name, heading and intro read as one
            masthead. The form below stays left-aligned inside its card —
            centred labels and inputs are harder to scan down. */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            {branch.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branch.logoUrl} alt="" className="h-11 w-auto" />
            )}
            <div className="text-left">
              <p className="text-[17px] font-semibold leading-tight text-white">MCPD Portal</p>
              <p className="text-[13px] leading-tight text-white/70">
                {branch.branchName.replace(/^NIESV\s*/, "")}
              </p>
            </div>
          </div>
          <h1 className="mt-8 text-[26px] text-white">Admin sign in</h1>
          <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-white/75">
            For authorised {branch.branchName.replace(/^NIESV\s*/, "NIESV ")} administrators.
            Every sign in is recorded.
          </p>
        </div>

        <LoginForm />

        <div className="mt-8 text-center">
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="text-[14px] text-white/80 underline underline-offset-4 hover:text-white"
          >
            Return to the public site
          </Link>
        </div>
      </div>
    </div>
  );
}