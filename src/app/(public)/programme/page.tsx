import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getFeaturedEvent, getEventView } from "@/lib/site";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("programme");
}

export default async function ProgrammePage() {
  const [featured, copy] = await Promise.all([getFeaturedEvent(), getCopy("programme")]);
  const event = featured ? await getEventView(featured) : null;

  return (
    <>
      <PageBanner title={copy.title} crumb="Programme" />
      <div className="container-content py-14">
        {copy.intro && (
          <p className="max-w-prose text-[17px] leading-relaxed text-muted">{copy.intro}</p>
        )}

        {!event || event.programme.length === 0 ? (
          <p className="mt-8 text-[17px] text-muted">{copy.empty}</p>
        ) : (
          <ul className="mt-8">
            {event.programme.map((s, i) => (
              <li key={i} className={`flex gap-6 border-b border-line py-5 last:border-b-0 ${s.isBreak ? "bg-paper" : ""}`}>
                <span className={`mono w-[96px] shrink-0 text-[15px] ${s.isBreak ? "text-muted" : "text-gold"}`}>{s.time}</span>
                <span>
                  <span className={`block text-[17px] ${s.isBreak ? "text-muted" : "font-semibold text-ink"}`}>{s.title}</span>
                  {!s.isBreak && (
                    <span className="block text-[15px] text-muted">
                      {s.speaker || "Speaker to be announced"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}