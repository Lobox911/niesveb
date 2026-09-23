"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Slide = {
  id: string;
  eyebrow: string | null;
  title: string;
  dateLine: string | null;
  venueLine: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

/**
 * One slide per upcoming event.
 *
 * No autoplay. A hero that moves on its own steals the reader's place mid
 * sentence and is a well-known accessibility problem; with a handful of real
 * events the reader can page through at their own speed. Arrow keys work,
 * swipe works on touch, and a single slide renders without any controls at
 * all rather than showing a one-dot pager.
 */
export default function HeroSlider({
  slides,
  fallbackDate,
  fallbackVenue,
}: {
  slides: Slide[];
  fallbackDate?: string | null;
  fallbackVenue?: string | null;
}) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const many = slides.length > 1;

  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((n) => (n + 1) % slides.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + slides.length) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, slides.length]);

  const s = slides[i];
  if (!s) return null;

  // A slide with no date or venue falls back to the event settings, so the
  // hero is never bare just because someone left a field blank.
  const dateLine = s.dateLine || fallbackDate || null;
  const venueLine = s.venueLine || fallbackVenue || null;

  return (
    <section
      className="relative flex min-h-[420px] items-center overflow-hidden bg-ink md:min-h-[480px]"
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? "Upcoming events" : undefined}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) {
          setI((n) => (dx < 0 ? (n + 1) % slides.length : (n - 1 + slides.length) % slides.length));
        }
        touchX.current = null;
      }}
    >
      {s.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.imageUrl}
            alt={s.imageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* A left-to-right gradient rather than a flat overlay: dark where
              the text sits, clearing over the right of the frame so the image
              itself stays visible. A flat scrim would dim the whole photo;
              none at all would make white text unreadable on a bright sky,
              and the branch cannot know in advance which they will upload. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/35"
            aria-hidden
          />
          {/* Floor of contrast for the very brightest images. */}
          <div className="absolute inset-0 bg-ink/25" aria-hidden />
        </>
      )}

      <div className="container-content relative z-10 w-full py-16 md:py-20">
        <div aria-live="polite" aria-atomic="true">
          {s.eyebrow && (
            <p className="mono text-[13px] uppercase tracking-[0.2em] text-gold">{s.eyebrow}</p>
          )}
          <h1 className="mt-5 max-w-[18ch] text-[30px] leading-[1.15] text-white md:text-[46px]">
            {s.title}
          </h1>

          {(dateLine || venueLine) && (
            <dl className="mt-9 max-w-[420px]">
              {dateLine && (
                <div className="flex justify-between gap-6 border-b border-gold/30 py-3">
                  <dt className="mono text-[13px] uppercase tracking-wider text-white/60">Date</dt>
                  <dd className="mono text-[15px] text-white">{dateLine}</dd>
                </div>
              )}
              {venueLine && (
                <div className="flex justify-between gap-6 border-b border-gold/30 py-3">
                  <dt className="mono text-[13px] uppercase tracking-wider text-white/60">Venue</dt>
                  <dd className="mono text-[15px] text-white">{venueLine}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={s.ctaHref || "/register"} className="btn-primary">
              {s.ctaLabel || "Register now"}
            </Link>
            <Link href="/join" className="btn-onink">Join online</Link>
          </div>
        </div>

        {many && (
          <div className="mt-12 flex items-center gap-4">
            <button
              type="button"
              aria-label="Previous event"
              onClick={() => setI((n) => (n - 1 + slides.length) % slides.length)}
              className="btn-onink px-3"
            >
              ‹
            </button>

            <div className="flex gap-2" role="tablist" aria-label="Choose event">
              {slides.map((sl, n) => (
                <button
                  key={sl.id}
                  type="button"
                  role="tab"
                  aria-selected={n === i}
                  aria-label={sl.title}
                  onClick={() => setI(n)}
                  className={`h-2 rounded transition-all ${
                    n === i ? "w-8 bg-gold" : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Next event"
              onClick={() => setI((n) => (n + 1) % slides.length)}
              className="btn-onink px-3"
            >
              ›
            </button>

            <span className="mono ml-2 text-[13px] text-white/60">
              {i + 1} / {slides.length}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}