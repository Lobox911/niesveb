import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getBranch, getFeaturedEvent, getEventView } from "@/lib/site";
import RegisterForm from "./RegisterForm";
import { getCopy, pageMeta } from "@/lib/pages";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("register");
}

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [branch, featured, copy] = await Promise.all([getBranch(), getFeaturedEvent(), getCopy("register")]);
  const event = featured ? await getEventView(featured) : null;

  if (!event) {
    return (
      <>
        <PageBanner title={copy.title} crumb="Registration" />
        <div className="container-content py-16">
          <p className="max-w-prose text-[17px] text-muted">{copy.closedMessage}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBanner title={copy.title} crumb="Registration" />

      <div className="container-content py-12 md:py-16">
        {/* Explanation before the form, the way a branch officer would write it
            to a colleague. The bank details sit inside the instruction rather
            than in a separate block, because that is the moment they are
            needed. */}
        <section className="max-w-prose">
          <p className="text-[17px] leading-relaxed text-muted">{copy.intro}</p>

          <p className="mt-4 text-[17px] leading-relaxed text-muted">{copy.paymentNote}</p>

          {branch.accountNumber && (
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              <strong className="font-semibold">
                {branch.bankName} {branch.accountNumber}, {branch.accountName}
              </strong>
            </p>
          )}
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