"use client";
import { useState, useTransition } from "react";
import { uploadHeroBackground } from "../actions";

/**
 * One background for the whole hero. The branch vets it once, which is what
 * makes dark text over an un-dimmed photograph safe — and the tone control is
 * their escape hatch if they later choose a dark image.
 */
export default function HeroBackground({
  current, alt, tone,
}: { current: string | null; alt: string | null; tone: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Hero background</h2>
      <p className="mt-1 text-[15px] text-muted">
        One image behind every slide. Choose something with a plain, pale area
        on the left where the text sits.
      </p>

      <form
        className="card mt-5 p-5"
        action={(fd) => start(async () => { setMsg(await uploadHeroBackground(fd)); })}
      >
        {current && (
          <div className="mb-4">
            <p className="mono text-[12px] uppercase tracking-wider text-muted">Current</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt="" className="mt-2 h-32 w-full rounded border border-line object-cover" />
          </div>
        )}

        <label className="label" htmlFor="heroImage">
          {current ? "Replace the background" : "Upload a background"}
        </label>
        <input id="heroImage" name="heroImage" type="file"
          accept="image/jpeg,image/png,image/webp" className="field py-2.5" />
        <p className="help">JPG, PNG or WebP, maximum 5MB. Landscape, around 1600 by 900.</p>

        <label className="label mt-4" htmlFor="heroImageAlt">Image description</label>
        <input id="heroImageAlt" name="heroImageAlt" className="field" defaultValue={alt ?? ""} />

        <fieldset className="mt-5">
          <legend className="label">Text colour</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-3 text-[15px] text-ink">
              <input type="radio" name="heroTextTone" value="dark" defaultChecked={tone !== "light"} className="mt-1" />
              <span>
                Dark text, no dimming
                <span className="block text-[13px] text-muted">
                  For a pale image. Keeps the photograph at full brightness.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-[15px] text-ink">
              <input type="radio" name="heroTextTone" value="light" defaultChecked={tone === "light"} className="mt-1" />
              <span>
                White text over a dark overlay
                <span className="block text-[13px] text-muted">
                  For a dark or busy image. Safe with anything, but dims the photo.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {msg?.error && <p role="alert" className="mt-4 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mt-4 text-[14px] text-green">Saved. Check the home page.</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-5 disabled:opacity-60">
          {pending ? "Saving" : "Save background"}
        </button>
      </form>
    </section>
  );
}