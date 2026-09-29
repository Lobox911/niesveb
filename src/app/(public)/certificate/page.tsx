import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import CertificateGate from "./CertificateGate";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("certificate");
}

/** The eligibility states — payment unconfirmed, no attendance record, event
 *  not yet held — are handled inside CertificateGate, which can see the
 *  registration. This page only sets the scene. */
export default async function CertificatePage() {
  const copy = await getCopy("certificate");

  return (
    <>
      <PageBanner title={copy.title} crumb="Certificate" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <p className="text-[17px] leading-relaxed text-muted">{copy.intro}</p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">{copy.notYet}</p>
        </section>

        <div className="mt-10">
          <CertificateGate />
        </div>
      </div>
    </>
  );
}