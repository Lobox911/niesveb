import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db, branchSettings } from "@/db";
import { requireOfficer } from "@/lib/auth";
import SettingsForm from "../SettingsForm";
import LogoUpload from "../event/LogoUpload";
import HeroBackground from "../event/HeroBackground";

export const metadata: Metadata = { title: "Site settings" };

/**
 * Things that stay true between events: who the branch is, how to reach them,
 * the crest, the hero backdrop. The event page holds what changes each year.
 */
export default async function SitePage() {
  const officer = await requireOfficer();
  if (officer.role !== "admin") redirect("/admin");

  const rows = await db.select().from(branchSettings).limit(1);
  const s = rows[0];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-[26px] text-ink">Site settings</h1>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        The branch identity and contact details. These rarely change and apply
        to every event.
      </p>

      <SettingsForm
        submitLabel="Save site settings"
        initial={{
          branchName: s?.branchName ?? "",
          registeredAddress: s?.registeredAddress ?? "",
          contactPhones: s?.contactPhones ?? "",
          contactEmail: s?.contactEmail ?? "",
          supportWhatsapp: s?.supportWhatsapp ?? "",
          aboutBody: s?.aboutBody ?? "",
          bankName: s?.bankName ?? "",
          accountName: s?.accountName ?? "",
          accountNumber: s?.accountNumber ?? "",
        }}
        groups={[
          {
            legend: "The branch",
            fields: [
              { name: "branchName", label: "Branch name", help: "Appears in the footer and page titles." },
              { name: "registeredAddress", label: "Registered address", help: "Shown in the footer." },
            ],
          },
          {
            legend: "Contact",
            fields: [
              { name: "contactPhones", label: "Contact phone numbers", help: "Separate several with commas. They appear in the footer as tappable links." },
              { name: "contactEmail", label: "Contact email", type: "email" },
              { name: "supportWhatsapp", label: "Support WhatsApp number" },
            ],
          },
          {
            legend: "Bank details",
            fields: [
              { name: "bankName", label: "Bank name" },
              { name: "accountName", label: "Account name" },
              { name: "accountNumber", label: "Account number", mono: true, help: "The same account is used for every event. Check it digit by digit." },
            ],
          },
          {
            legend: "About the branch",
            fields: [
              { name: "aboutBody", label: "Body text", textarea: true, help: "Leave a blank line between paragraphs. Blank falls back to the default copy." },
            ],
          },
        ]}
      />

      <LogoUpload current={s?.logoUrl ?? null} />

      <HeroBackground
        current={s?.heroImageUrl ?? null}
        alt={s?.heroImageAlt ?? null}
        tone={s?.heroTextTone ?? "dark"}
      />
    </div>
  );
}