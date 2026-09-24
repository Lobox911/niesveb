import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PasscodeGate from "@/components/PasscodeGate";

export const metadata: Metadata = { title: "Certificate of participation" };

export default function CertificatePage() {
  return (
    <>
      <PageBanner title="Certificate of participation" crumb="Certificate" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <h2 className="text-[20px] text-ink">Print your certificate</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">
            Dear participant,
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Enter your registration code to open your e-certificate of
            participation. Certificates become available after the seminar, once
            your attendance has been recorded and your payment confirmed.
          </p>
        </section>

        {/* TODO: eligibility states — not yet held / unconfirmed / no attendance */}
        <div className="mt-10">
          <PasscodeGate cta="Open my certificate" />
        </div>
      </div>
    </>
  );
}