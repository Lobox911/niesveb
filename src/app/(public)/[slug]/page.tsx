import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomPage, toBlocks } from "@/lib/pages";
import { getBranch } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Renders a page the branch wrote in the dashboard.
 *
 * This route is the last to match, so every page with a route of its own —
 * /register, /join, /certificate — is answered by that route and never reaches
 * here. The admin refuses to create a page on one of those addresses anyway,
 * but the ordering is what guarantees it.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCustomPage(slug);
  if (!page) return {};

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.intro || undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  const [page, branch] = await Promise.all([getCustomPage(slug), getBranch()]);
  if (!page) notFound();

  const blocks = toBlocks(page.body);
  const banner = page.bannerImageUrl || branch.bannerImageUrl;
  const bannerAlt = page.bannerImageAlt || branch.bannerImageAlt || "";

  return (
    <>
      <section className="relative flex min-h-[220px] items-end overflow-hidden bg-ink">
        {banner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt={bannerAlt} className="absolute inset-0 h-full w-full object-cover" />
            {/* Always scrimmed: unlike the home hero, nobody previews this
                image against the text before it goes up. */}
            <div className="absolute inset-0 bg-ink/55" aria-hidden />
          </>
        )}
        <div className="container-content relative z-10 w-full py-12">
          <h1 className="text-[30px] font-bold leading-tight text-white md:text-[38px]">{page.title}</h1>
          {page.intro && (
            <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-white/90">{page.intro}</p>
          )}
        </div>
      </section>

      <div className="container-content py-14">
        <div className="max-w-[68ch]">
          {blocks.length === 0 ? (
            <p className="text-[16px] text-muted">This page has not been written yet.</p>
          ) : (
            blocks.map((b, i) =>
              b.type === "h2" ? (
                <h2 key={i} className="mt-10 text-[22px] text-ink first:mt-0">{b.text}</h2>
              ) : (
                <p key={i} className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-muted">
                  {b.text}
                </p>
              ),
            )
          )}
        </div>
      </div>
    </>
  );
}