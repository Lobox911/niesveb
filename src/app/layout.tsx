import type { Metadata } from "next";
import { Source_Serif_4, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { getBranch, getFeaturedEvent, hexToRgbTriplet } from "@/lib/site";
import "./globals.css";

/**
 * Display face: Source Serif 4.
 *
 * Previously Fraunces, which ships a WONK axis of deliberately eccentric
 * glyph shapes — the splayed "g", the odd "ffi" — that read as distortion
 * rather than character on an institutional site. Source Serif has no such
 * axes: it is a straightforward text serif with the authority this needs
 * and none of the quirk.
 */
const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-src",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono-src",
  display: "swap",
});

/** Title, description, favicon and share image all come from the database so
 *  the branch can tune them without a deploy. Each falls back to the featured
 *  event, so a blank field never produces an empty tag. */
export async function generateMetadata(): Promise<Metadata> {
  const [branch, featured] = await Promise.all([getBranch(), getFeaturedEvent()]);

  const title = branch.metaTitle || (featured ? `${featured.title} — ${branch.branchName}` : branch.branchName);
  const description =
    branch.metaDescription ||
    (featured
      ? `${featured.title}. ${featured.theme}. ${featured.venue}.`
      : branch.branchName);

  // Two domains serve this application. Without a canonical, search engines
  // index both and split whatever ranking the branch earns between them.
  const base = branch.canonicalUrl ? new URL(branch.canonicalUrl) : undefined;

  return {
    metadataBase: base,
    title: { default: title, template: `%s — ${branch.branchName}` },
    description,
    alternates: base ? { canonical: "/" } : undefined,
    robots: branch.searchIndexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    verification: branch.googleVerification
      ? { google: branch.googleVerification }
      : undefined,
    icons: branch.faviconUrl ? { icon: branch.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: branch.branchName,
      title,
      description,
      url: base ? "/" : undefined,
      images: branch.ogImageUrl ? [branch.ogImageUrl] : undefined,
    },
    twitter: {
      card: branch.ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: branch.ogImageUrl ? [branch.ogImageUrl] : undefined,
    },
  };
}

/**
 * Root layout holds only the document shell and fonts.
 * Header and Footer live in (public)/layout.tsx so the admin does NOT
 * inherit the public navigation.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branch = await getBranch();

  // Only the two brand colours are overridable. They are written as RGB
  // triplets so Tailwind's opacity modifiers keep working.
  const primary = hexToRgbTriplet(branch.primaryColor);
  const accent = hexToRgbTriplet(branch.accentColor);
  const overrides = [
    primary && `--green-rgb: ${primary};`,
    accent && `--gold-rgb: ${accent};`,
  ].filter(Boolean).join(" ");

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {overrides && <style>{`:root { ${overrides} }`}</style>}
        {branch.analyticsId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${branch.analyticsId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${branch.analyticsId.replace(/'/g, "")}')`,
              }}
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}