"use client";
import { Children, useState } from "react";

/**
 * One section on screen at a time.
 *
 * Site settings ran six screens deep with every form expanded, and the tabs
 * above it only scrolled. Switching instead of scrolling takes the page under
 * one screen and removes the ambiguity that comes with several forms visible
 * at once — each of these blocks has its own Save button, and a person who can
 * see three of them cannot tell which one their changes belong to.
 *
 * Two columns would have made that worse rather than better.
 *
 * Panels stay mounted and are hidden with the `hidden` attribute rather than
 * unmounted, so switching away from a half-filled form and back does not throw
 * away what was typed. The cost is that all of it renders up front, which for
 * a handful of settings forms is nothing.
 */
export default function TabbedSections({
  items,
  children,
  storageKey,
}: {
  items: { id: string; label: string }[];
  children: React.ReactNode;
  /** Remembers the open tab across a save, which reloads the page. */
  storageKey?: string;
}) {
  const panels = Children.toArray(children);

  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return items[0]?.id;

    // A save revalidates and re-renders; without this the branch is dropped
    // back on the first tab every time they save something on the sixth.
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash && items.some((i) => i.id === fromHash)) return fromHash;

    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved && items.some((i) => i.id === saved)) return saved;
      } catch {
        // Private browsing, or storage disabled. The first tab is fine.
      }
    }
    return items[0]?.id;
  });

  const choose = (id: string) => {
    setActive(id);
    try {
      if (storageKey) sessionStorage.setItem(storageKey, id);
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* not worth failing a tab switch over */
    }
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Settings sections"
        className="sticky top-0 z-30 -mx-6 mb-8 overflow-x-auto border-b border-line bg-paper/95 px-6 backdrop-blur lg:-mx-10 lg:px-10"
      >
        <div className="flex gap-1">
          {items.map((it) => {
            const on = it.id === active;
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                id={`tab-${it.id}`}
                aria-selected={on}
                aria-controls={`panel-${it.id}`}
                onClick={() => choose(it.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-[15px] transition-colors ${
                  on
                    ? "border-green font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      </div>

      {items.map((it, i) => (
        <div
          key={it.id}
          role="tabpanel"
          id={`panel-${it.id}`}
          aria-labelledby={`tab-${it.id}`}
          hidden={it.id !== active}
          /* Each section was written to sit below the one before it, so it
             carries its own top margin. As the first thing in a panel that
             margin is just a gap under the tabs. */
          /* Both the attribute and the class: the attribute carries the
             meaning for assistive technology, the class guarantees the
             display, because any stylesheet rule setting `display` on a div
             would otherwise beat [hidden]. */
          className={`[&>section:first-child]:mt-0 [&>form:first-child]:mt-0 ${
            it.id === active ? "" : "hidden"
          }`}
        >
          {panels[i]}
        </div>
      ))}
    </>
  );
}