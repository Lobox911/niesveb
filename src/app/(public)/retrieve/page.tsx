import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import RetrieveForm from "./RetrieveForm";

export const metadata: Metadata = { title: "Retrieve passcode" };

export default function RetrievePage() {
  return (
    <>
      <PageBanner title="Registration code" crumb="Retrieve code" />
      <div className="container-content py-12 md:py-16">
        <section className="max-w-prose">
          <h2 className="text-[20px] text-ink">Retrieve your registration code</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">
            Enter your NIESV membership number, or the email address you
            registered with, and your code will be shown and sent to you again.
          </p>
        </section>

        <div className="mt-10">
          <RetrieveForm />
        </div>
      </div>
    </>
  );
}