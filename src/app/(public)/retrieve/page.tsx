import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import RetrieveForm from "./RetrieveForm";

export const metadata: Metadata = { title: "Retrieve passcode" };

export default function RetrievePage() {
  return (
    <>
      <PageBanner title="Retrieve passcode" crumb="Retrieve passcode" />
      <div className="container-content py-14">
        <RetrieveForm />
      </div>
    </>
  );
}
