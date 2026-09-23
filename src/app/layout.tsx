import type { Metadata } from "next";
import { Fraunces, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { event } from "@/lib/event";
import "./globals.css";

/**
 * Fraunces ships a WONK axis that swaps in deliberately eccentric glyph
 * shapes (the odd "g", the strange "ffi") and defaults to ON. It also has
 * SOFT and an optical-size axis. next/font can only request the axes; the
 * values are set in globals.css via font-variation-settings.
 */
const display = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  axes: ["SOFT", "WONK", "opsz"],
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

export const metadata: Metadata = {
  title: { default: `${event.eventTitle} — ${event.branch}`, template: `%s — ${event.branch}` },
  description: `${event.eventTitle}. ${event.theme}. ${event.date}, ${event.venue}.`,
  robots: { index: true, follow: true },
};

/**
 * Root layout holds only the document shell and fonts.
 * Header and Footer live in (public)/layout.tsx so the admin does NOT
 * inherit the public navigation.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}