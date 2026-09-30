"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The mobile chrome for the admin area.
 *
 * The sidebar was a flex column that simply stacked above the content below
 * the `lg` breakpoint, so every page on a phone opened with roughly six
 * hundred pixels of navigation and a Sign out button before a single word of
 * the actual page. Worse on every subsequent navigation, because you land at
 * the top of the menu again.
 *
 * On a phone the navigation becomes a bar and a sheet. On a laptop nothing
 * changes — the sidebar is still the right shape there.
 */
export default function AdminShell({
  nav, footer, children,
}: {
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Close on navigation, or the sheet stays over the page you just opened.
  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // Stop the page behind the sheet scrolling under it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      {/* Phone: a bar. */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <div>
          <p className="text-[16px] font-semibold leading-tight text-ink">MCPD Portal</p>
          <p className="text-[12px] leading-tight text-muted">Ebonyi State Branch</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-menu"
          onClick={() => setOpen((v) => !v)}
          className="btn-secondary min-h-[44px] px-4"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="admin-menu"
            role="dialog"
            aria-label="Admin menu"
            className="absolute inset-y-0 right-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white"
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <p className="text-[16px] font-semibold text-ink">Menu</p>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-[44px] px-4">
                Close
              </button>
            </div>
            {nav}
            <div className="mt-auto border-t border-line p-5">{footer}</div>
          </div>
        </div>
      )}

      {/* Laptop: the sidebar, unchanged. */}
      <aside className="hidden flex-col border-r border-line bg-white lg:flex lg:min-h-screen">
        <div className="border-b border-line p-5">
          <p className="text-[17px] font-semibold text-ink">MCPD Portal</p>
          <p className="text-[13px] text-muted">Ebonyi State Branch</p>
        </div>
        {nav}
        <div className="mt-auto border-t border-line p-5">{footer}</div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}