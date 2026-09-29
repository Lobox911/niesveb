import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PhotoCardGate from "./PhotoCardGate";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("photo-card");
}

export default async function PhotoCardPage() {
  const copy = await getCopy("photo-card");

  return (
    <>
      <PageBanner title={copy.title} crumb="Photo card" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <p className="text-[17px] leading-relaxed text-muted">{copy.intro}</p>
        </section>

        <div className="mt-10">
          <PhotoCardGate help={copy.help} />
        </div>
      </div>
    </>
  );
}