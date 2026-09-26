import type { MetadataRoute } from "next";
import { getBranch } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Only the pages a stranger should land on.
 *
 * The passcode gates — photo card, join, certificate — are listed because
 * people search for them by name ahead of the seminar, and each one explains
 * itself before asking for a code. The success page is not: it means nothing
 * without the cookie that produced it.
 */
const PATHS: { path: string; priority: number; frequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, frequency: "weekly" },
  { path: "/register", priority: 0.9, frequency: "weekly" },
  { path: "/programme", priority: 0.7, frequency: "weekly" },
  { path: "/join", priority: 0.5, frequency: "monthly" },
  { path: "/photo-card", priority: 0.5, frequency: "monthly" },
  { path: "/certificate", priority: 0.5, frequency: "monthly" },
  { path: "/retrieve", priority: 0.4, frequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const branch = await getBranch();

  // With no canonical set there is no absolute URL to publish, and a sitemap
  // of relative paths is invalid. Better empty than wrong.
  if (!branch.canonicalUrl || !branch.searchIndexable) return [];

  const now = new Date();
  return PATHS.map(({ path, priority, frequency }) => ({
    url: `${branch.canonicalUrl}${path}`,
    lastModified: now,
    changeFrequency: frequency,
    priority,
  }));
}