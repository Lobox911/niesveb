import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import DetailsForm from "./DetailsForm";

export const metadata: Metadata = { title: "Participant details" };

export default async function DetailsPage({
  searchParams,
}: { searchParams: Promise<{ category?: string; mode?: string }> }) {
  const { category, mode } = await searchParams;
  return (
    <>
      <PageBanner title="Participant details" crumb="Registration" />
      <div className="container-content py-12">
        <DetailsForm category={category} mode={mode} />
      </div>
    </>
  );
}
