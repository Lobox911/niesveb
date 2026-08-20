import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import CategoryPicker from "./CategoryPicker";
import { event } from "@/lib/event";

export const metadata: Metadata = { title: "Registration" };

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return (
    <>
      <PageBanner title="Registration" crumb="Registration" />
      <div className="container-content py-12">
        <p className="max-w-prose text-[17px] leading-relaxed text-muted">
          Pay into the branch account first, then register here using your
          transaction reference. Your email address must be valid, because your
          passcode and e-certificate are delivered to it.
        </p>
        <p className="mono mt-4 select-all text-[17px] text-ink">
          {event.bankName} · {event.accountNumber}
        </p>
        <CategoryPicker preselect={category} />
      </div>
    </>
  );
}
