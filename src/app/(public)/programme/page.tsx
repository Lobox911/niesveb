import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getSiteData } from "@/lib/site";

export const metadata: Metadata = { title: "Programme" };

export default async function ProgrammePage() {
  const event = await getSiteData();
  return (
    <>
      <PageBanner title="Programme" crumb="Programme" />
      <div className="container-content py-14">
        {event.programme.length === 0 ? (
          <p className="text-[17px] text-muted">
            The programme is being finalised and will be published here shortly.
          </p>
        ) : (
          <ul>
            {event.programme.map((s, i) => (
              <li key={i} className={`flex gap-6 border-b border-line py-5 last:border-b-0 ${s.isBreak ? "bg-paper" : ""}`}>
                <span className={`mono w-[96px] shrink-0 text-[15px] ${s.isBreak ? "text-muted" : "text-gold"}`}>{s.time}</span>
                <span>
                  <span className={`block text-[17px] ${s.isBreak ? "text-muted" : "font-semibold text-ink"}`}>{s.title}</span>
                  {!s.isBreak && (
                    <span className="block text-[15px] text-muted">
                      {s.speaker || "Speaker to be announced"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}