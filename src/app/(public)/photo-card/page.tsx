import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PasscodeGate from "@/components/PasscodeGate";

export const metadata: Metadata = { title: "Photo card" };

export default function PhotoCardPage() {
  return (
    <>
      <PageBanner title="Photo card" crumb="Photo card" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <h2 className="text-[20px] text-ink">Picture upload and printing</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">
            Dear participant,
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Enter your registration code correctly to continue. You will then
            upload a portrait, and the portal produces a participant card you
            can print or keep on your phone for the venue.
          </p>
        </section>

        {/* TODO: on a valid code, advance to upload → crop → preview */}
        <div className="mt-10">
          <PasscodeGate cta="Continue" />
        </div>
      </div>
    </>
  );
}