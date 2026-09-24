"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
  { href: "/retrieve", label: "Retrieve code" },
  { href: "/photo-card", label: "Photo card" },
  { href: "/certificate", label: "Certificate" },
  { href: "/programme", label: "Programme" },
];

export default function Header({ logoUrl, branch }: { logoUrl?: string | null; branch?: string } = {}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="container-content flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="" className="h-10 w-auto" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded bg-ink text-white mono text-[13px]">
              EB
            </span>
          )}
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-ink">NIESV</span>
            <span className="block text-[12px] text-muted">{branch ?? "Ebonyi State Branch"}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`text-[15px] font-medium ${
                  active
                    ? "text-ink underline decoration-green decoration-2 underline-offset-[6px]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <Link href="/join" className="btn-primary">Join online</Link>
        </nav>

        <button
          type="button"
          className="lg:hidden btn-secondary px-3"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden border-t border-line bg-paper">
          <nav className="container-content py-2" aria-label="Mobile">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block border-b border-line py-4 text-[17px] text-ink last:border-b-0"
              >
                {n.label}
              </Link>
            ))}
            <Link href="/join" className="btn-primary my-4 w-full">Join online</Link>
          </nav>
        </div>
      )}
    </header>
  );
}