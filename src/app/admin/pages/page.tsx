import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, pages } from "@/db";
import { requireOfficer } from "@/lib/auth";
import { ensureSystemPages } from "../actions";
import { SYSTEM_PAGES, systemPage } from "@/lib/pages";
import PagesManager from "./PagesManager";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function PagesAdmin() {
  await requireOfficer();

  // First visit seeds a row per built-in page, so the branch has something to
  // edit and the menu something to order.
  await ensureSystemPages();

  const rows = await db.select().from(pages).orderBy(asc(pages.navOrder));

  const view = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    intro: p.intro ?? "",
    body: p.body ?? "",
    copy: p.copy ?? "",
    navLabel: p.navLabel ?? "",
    showInNav: p.showInNav,
    navOrder: p.navOrder,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    bannerImageUrl: p.bannerImageUrl,
    bannerImageAlt: p.bannerImageAlt ?? "",
    published: p.published,
    path: p.kind === "system" ? (systemPage(p.slug)?.path ?? `/${p.slug}`) : `/${p.slug}`,
    purpose: p.kind === "system" ? (systemPage(p.slug)?.purpose ?? "") : "",
  }));

  // Slot definitions travel to the client so the editor can render the right
  // boxes with the shipped wording as placeholders.
  const slots = Object.fromEntries(SYSTEM_PAGES.map((p) => [p.slug, p.slots]));

  return (
    <div className="container-content py-10">
      <h1 className="text-[26px] text-ink">Pages</h1>
      <p className="mt-2 max-w-[640px] text-[15px] text-muted">
        Every page on the public site. Change the wording, the menu label and
        the search description, reorder the menu, or add a page of your own.
      </p>

      <PagesManager rows={view} slots={slots} />
    </div>
  );
}