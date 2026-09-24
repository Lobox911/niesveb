import Link from "next/link";
import { currentYear } from "@/lib/event";
import { getSiteData } from "@/lib/site";

/**
 * Rebuilt. In the Stitch export the column headings were <a href="#"> with
 * empty lists beneath, so the footer was three dead links and a copyright.
 * Headings are <h3>; every column reads from the database via getSiteData.
 */
export default async function Footer() {
  const event = await getSiteData();
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="container-content grid gap-10 py-14 md:grid-cols-3">
        <div>
          <h3 className="text-[20px]">{event.branch}</h3>
          <p className="mt-3 text-[15px] text-white/70">{event.eventTitle}</p>
          <p className="mono mt-3 text-[14px] text-white/70">{event.date}</p>
          <p className="mt-1 text-[15px] text-white/70">{event.venue}</p>

          {event.contactPhones.length > 0 && (
            <ul className="mt-4 space-y-1">
              {event.contactPhones.map((p) => (
                <li key={p}>
                  <a className="mono text-[14px] text-white/80 hover:underline" href={`tel:${p}`}>{p}</a>
                </li>
              ))}
            </ul>
          )}
          {event.email && (
            <a className="mt-2 block text-[14px] text-white/80 hover:underline" href={`mailto:${event.email}`}>
              {event.email}
            </a>
          )}
        </div>

        <div>
          <h3 className="text-[17px]">Quick links</h3>
          <ul className="mt-4 space-y-2">
            {[
              ["/", "Home"], ["/register", "Register"], ["/retrieve", "Retrieve code"],
              ["/photo-card", "Photo card"], ["/certificate", "Certificate"],
              ["/programme", "Programme"], ["/join", "Join online"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link className="text-[15px] text-white/70 hover:text-white hover:underline" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[17px]">Participation categories</h3>
          <ul className="mt-4 space-y-2">
            {event.categories.map((c) => (
              <li key={c.id}>
                <Link
                  className="text-[15px] text-white/70 hover:text-white hover:underline"
                  href={`/register?category=${c.id}`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-content py-6">
          <p className="text-[14px] text-white/70">
            © {currentYear} {event.branch}. All rights reserved.
          </p>
          {event.registeredAddress && (
            <p className="mt-1 text-[13px] text-white/50">{event.registeredAddress}</p>
          )}
        </div>
      </div>
    </footer>
  );
}