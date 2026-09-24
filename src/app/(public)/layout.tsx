import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSiteData } from "@/lib/site";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteData();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header logoUrl={site.logoUrl} branch={site.branch.replace(/^NIESV\s*/, "")} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}