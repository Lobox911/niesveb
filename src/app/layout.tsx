import type { Metadata } from "next";
import { Fraunces, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { event } from "@/lib/event";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], weight: ["600"], variable: "--font-display-src", display: "swap" });
const body = Inter_Tight({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-body-src", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono-src", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${event.eventTitle} — ${event.branch}`, template: `%s — ${event.branch}` },
  description: `${event.eventTitle}. ${event.theme}. ${event.date}, ${event.venue}.`,
  // Indexable. The site we are replacing was noindex on every page.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
