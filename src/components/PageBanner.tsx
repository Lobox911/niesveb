import Link from "next/link";
import { getBranch } from "@/lib/site";

/**
 * The banner across every inner page. It loads the background itself rather
 * than taking it as a prop, so adding a page never means remembering to pass
 * the image through.
 *
 * The scrim is unconditional here, unlike the hero. The branch can preview the
 * home page against one chosen image; they cannot preview every inner page, so
 * white text has to hold whatever they upload.
 */
export default async function PageBanner({
  title, crumb,
}: { title: string; crumb: string }) {
  const branch = await getBranch();

  return (
    <div className="relative overflow-hidden bg-ink">
      {branch.bannerImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branch.bannerImageUrl}
            alt={branch.bannerImageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/70" aria-hidden />
        </>
      )}

      <div className="container-content relative z-10 py-12 md:py-16">
        <p className="mono text-[13px] text-white/70">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="px-2">/</span>
          <span>{crumb}</span>
        </p>
        <h1 className="mt-2 text-[30px] font-bold text-white md:text-[38px]">{title}</h1>
      </div>
    </div>
  );
}