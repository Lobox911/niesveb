import Link from "next/link";
import { getBranch } from "@/lib/site";

/**
 * Shared chrome for the sign-in, forgotten-password and reset pages, so all
 * three carry the same blurred branch backdrop rather than one being styled
 * and the other two looking like an unfinished afterthought.
 */
export default async function AuthShell({
  heading, intro, children,
}: { heading: string; intro: string; children: React.ReactNode }) {
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
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />
          <div className="absolute inset-0 bg-ink/75" aria-hidden />
        </>
      )}

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex items-center gap-3">
          {branch.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={branch.logoUrl} alt="" className="h-11 w-auto" />
          )}
          <div>
            <p className="text-[17px] font-semibold leading-tight text-white">MCPD Portal</p>
            <p className="text-[13px] leading-tight text-white/70">
              {branch.branchName.replace(/^NIESV\s*/, "")}
            </p>
          </div>
        </div>

        <h1 className="mt-8 text-[26px] text-white">{heading}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/75">{intro}</p>

        {children}

        <Link
          href="/"
          target="_blank"
          rel="noopener"
          className="mt-8 inline-block text-[14px] text-white/80 underline underline-offset-4 hover:text-white"
        >
          Return to the public site
        </Link>
      </div>
    </div>
  );
}