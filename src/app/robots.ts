import type { MetadataRoute } from "next";
import { getBranch } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Generated rather than a static file, so the branch can take the site out of
 * search from the dashboard while it is being prepared and put it back without
 * a deploy.
 *
 * The admin area is disallowed whatever the setting. It is behind a login, so
 * a crawler cannot read it, but listing it in results is noise nobody wants.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const branch = await getBranch();

  if (!branch.searchIndexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/register/success"],
      },
    ],
    sitemap: branch.canonicalUrl ? `${branch.canonicalUrl}/sitemap.xml` : undefined,
    host: branch.canonicalUrl || undefined,
  };
}