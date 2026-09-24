"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Slide = {
  id: string;
  eyebrow: string | null;
  title: string;
  dateLine: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/**
 * One fixed background, rotating content.
 *
 * Previously each slide carried its own image, which made every upload a
 * gamble: white text plus a 35-60% scrim was the only thing that survived an
 * unknown photo, and it dimmed the photograph to a grey wall.
 *
 * A single background vetted once by the branch removes that. They can see
 * whether the text area is pale, so dark text over an un-dimmed image is safe
 * — and `tone` lets them switch to light text if they later swap in something
 * dark, without needing a developer.
 *
 * No autoplay: a hero that advances on its own moves the reader's place
 * mid-sentence.
 */
export default function HeroSlider({
  slides,
  backgroundUrl,
  backgroundAlt,
  tone = "dark",
  fallbackDate,
  fallbackEyebrow,
}: {
  slides: Slide[];
  backgroundUrl?: string | null;
  backgroundAlt?: string | null;
  tone?: "dark" | "light";
  fallbackDate?: string | null;
  fallbackEyebrow?: string | null;
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

  // Every slide shows the same set of lines. A blank field falls back to the
  // branch setting rather than silently dropping the row, so slide two does
  // not look different from slide one because someone skipped a box.
  const dateLine = s.dateLine || fallbackDate || null;
  const eyebrow = s.eyebrow || fallbackEyebrow || null;

  // With no background the section falls back to solid ink, where light text
  // is the only readable option whatever tone is stored.
  const light = tone === "light" || !backgroundUrl;

  const textColour = light ? "text-white" : "text-ink";
  const ruleColour = light ? "border-white/50" : "border-ink/30";

  return (
    <section
      className="relative flex min-h-[460px] items-center overflow-hidden bg-ink md:min-h-[560px]"
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
      {backgroundUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundUrl}
            alt={backgroundAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Only on the light tone. On a vetted pale image there is no scrim
              at all, which is what keeps the photograph looking like one. */}
          {tone === "light" && <div className="absolute inset-0 bg-ink/45" aria-hidden />}
        </>
      )}

      <div className="container-content relative z-10 w-full py-16 md:py-20">
        <div aria-live="polite" aria-atomic="true">
          {eyebrow && (
            <p className={`flex items-center gap-2 text-[16px] font-medium ${textColour}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gold" aria-hidden>
                <path d="M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z" />
              </svg>
              {eyebrow}
            </p>
          )}

          <h1 className={`mt-5 max-w-[16ch] text-[34px] font-bold leading-[1.1] md:text-[56px] ${textColour}`}>
            {s.title}
          </h1>

          {dateLine && (
            <p className={`mt-8 border-l-2 pl-4 text-[18px] md:text-[20px] ${ruleColour} ${textColour}`}>
              {dateLine}
            </p>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={s.ctaHref || "/register"}
              className="btn-primary min-h-[54px] px-7 text-[16px] font-semibold"
            >
              {s.ctaLabel || "Register now"}
            </Link>
            {/* Solid, never outlined — a ghost button over a photograph is the
                first thing to disappear. */}
            <Link
              href="/join"
              className="btn min-h-[54px] bg-ink px-7 text-[16px] font-semibold text-white hover:opacity-90"
            >
              Join online
            </Link>
          </div>
        </div>

        {many && (
          <div className="mt-10 flex items-center gap-3">
            <div className="flex gap-2" role="tablist" aria-label="Choose event">
              {slides.map((sl, n) => (
                <button
                  key={sl.id}
                  type="button"
                  role="tab"
                  aria-selected={n === i}
                  aria-label={sl.title}
                  onClick={() => setI(n)}
                  className={`h-2.5 rounded transition-all ${
                    n === i
                      ? "w-9 bg-green"
                      : light
                        ? "w-2.5 bg-white/60 hover:bg-white"
                        : "w-2.5 bg-ink/30 hover:bg-ink/60"
                  }`}
                />
              ))}
            </div>
            <span className={`mono ml-2 text-[13px] ${light ? "text-white/80" : "text-muted"}`}>
              {i + 1} / {slides.length}
            </span>
          </div>
        )}
      </div>

      {many && (
        <>
          <button
            type="button"
            aria-label="Previous event"
            onClick={() => setI((n) => (n - 1 + slides.length) % slides.length)}
            className="absolute left-5 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded bg-white text-[22px] text-ink shadow-none hover:bg-paper md:grid lg:left-8"
          >
            <span aria-hidden>←</span>
          </button>
          <button
            type="button"
            aria-label="Next event"
            onClick={() => setI((n) => (n + 1) % slides.length)}
            className="absolute right-5 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded bg-white text-[22px] text-ink shadow-none hover:bg-paper md:grid lg:right-8"
          >
            <span aria-hidden>→</span>
          </button>
        </>
      )}
    </section>
  );
}