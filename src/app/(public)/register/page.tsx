import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getBranch, getFeaturedEvent, getEventView } from "@/lib/site";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Registration" };

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [branch, featured] = await Promise.all([getBranch(), getFeaturedEvent()]);
  const event = featured ? await getEventView(featured) : null;

  if (!event) {
    return (
      <>
        <PageBanner title="Registration" crumb="Registration" />
        <div className="container-content py-16">
          <p className="max-w-prose text-[17px] text-muted">
            Registration is not open at the moment. The branch will announce the
            next seminar here.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBanner title="MCPD Registration" crumb="Registration" />

      <div className="container-content py-12 md:py-16">
        {/* Explanation before the form, the way a branch officer would write it
            to a colleague. The bank details sit inside the instruction rather
            than in a separate block, because that is the moment they are
            needed. */}
        <section className="max-w-prose">
          <h2 className="text-[20px] text-ink">Participant registration</h2>

          <p className="mt-5 text-[17px] leading-relaxed text-muted">
            Dear prospective participant,
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            First check the fee schedule for the correct fee for your category.
            Then make payment into the designated bank account{" "}
            <strong className="font-semibold text-ink">
              {branch.bankName} {branch.accountNumber}, {branch.accountName}
            </strong>{" "}
            and use your receipt of transaction for this registration.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Use a valid email address. Your passcode, the link for virtual
            participation and your e-certificate of participation are all sent
            there.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Registration is mandatory for both physical and virtual participants
            in order to secure your e-certificate.
          </p>
        </section>

        <RegisterForm
          categories={event.categories}
          venue={event.venue}
          preselect={category}
        />
      </div>
    </>
  );
}