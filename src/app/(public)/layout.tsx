import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getBranch } from "@/lib/site";
import { getNav } from "@/lib/pages";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [branch, nav] = await Promise.all([getBranch(), getNav()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header logoUrl={branch.logoUrl} branch={branch.branchName.replace(/^NIESV\s*/, "")} nav={nav} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}