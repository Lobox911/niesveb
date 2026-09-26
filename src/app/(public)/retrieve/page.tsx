import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import RetrieveForm from "./RetrieveForm";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("retrieve");
}

export default async function RetrievePage() {
  const copy = await getCopy("retrieve");
  return (
    <>
      <PageBanner title={copy.title} crumb="Retrieve code" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <p className="text-[17px] leading-relaxed text-muted">{copy.intro}</p>
        </section>

        <div className="mt-10">
          <RetrieveForm />
        </div>
      </div>
    </>
  );
}