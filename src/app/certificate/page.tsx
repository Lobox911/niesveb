import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PasscodeGate from "@/components/PasscodeGate";

export const metadata: Metadata = { title: "Certificate of participation" };

export default function CertificatePage() {
  return (
    <>
      <PageBanner title="Certificate of participation" crumb="Certificate" />
      <div className="container-content py-14">
        <p className="mx-auto mb-8 max-w-prose text-center text-[15px] text-muted">
          Certificates open after the seminar, once attendance has been recorded.
        </p>
        {/* TODO: eligibility states — not yet held / unconfirmed / no attendance / eligible */}
        <PasscodeGate cta="Open my certificate" />
      </div>
    </>
  );
}
