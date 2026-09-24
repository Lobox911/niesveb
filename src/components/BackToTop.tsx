"use client";
import { useEffect, useState } from "react";

/**
 * The home page is long and the primary actions are at the top. Appears only
 * once the reader is well past the fold, so it never covers content on a
 * short page. Sits above the WhatsApp float rather than beside it.
 */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className="fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded border border-line bg-white text-ink hover:bg-paper"
    >
      <span aria-hidden className="text-[18px] leading-none">↑</span>
    </button>
  );
}