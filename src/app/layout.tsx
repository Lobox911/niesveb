import type { Metadata } from "next";
import { Source_Serif_4, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { event } from "@/lib/event";
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