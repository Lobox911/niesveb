import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import PasscodeGate from "@/components/PasscodeGate";

export const metadata: Metadata = { title: "Photo card" };

export default function PhotoCardPage() {
  return (
    <>
      <PageBanner title="Photo card" crumb="Photo card" />
      <div className="container-content py-14">
        <p className="mx-auto mb-8 max-w-prose text-center text-[15px] text-muted">
          Enter your passcode to upload a portrait and generate a printable
          participant card.
        </p>
        {/* TODO: on valid code, advance to upload → crop → preview (steps 2 and 3) */}
        <PasscodeGate cta="Continue" />
      </div>
    </>
  );
}
