"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string, boolean][] = [
  // [href, label, adminOnly]
  ["/admin", "Dashboard", false],
  ["/admin/attendance", "Attendance desk", false],
  ["/admin/event", "Event settings", true],
];

export default function AdminNav({ role }: { role: "officer" | "admin" }) {
  const path = usePathname();

  return (
    <nav className="p-3" aria-label="Admin">
      {NAV.filter(([, , adminOnly]) => !adminOnly || role === "admin").map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`block rounded px-3 py-2.5 text-[15px] ${
              active ? "bg-green text-white" : "text-ink hover:bg-paper"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}