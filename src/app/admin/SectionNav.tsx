"use client";
import { useEffect, useState } from "react";

/**
 * The event page has six major blocks and runs several screens deep. A sticky
 * jump list is the difference between "scroll until you find it" and going
 * straight there — which matters when the branch is editing one fee the week
 * of the seminar.
 */
export default function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-30 -mx-6 mb-2 border-b border-line bg-paper/95 px-6 py-3 backdrop-blur lg:-mx-10 lg:px-10"
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "true" : undefined}
              className={`text-[14px] underline-offset-4 hover:underline ${
                active === it.id ? "font-semibold text-ink" : "text-muted"
              }`}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}