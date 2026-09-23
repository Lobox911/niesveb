"use client";
import { useState, useTransition } from "react";
import { uploadFlyer, removeFlyer } from "../actions";

export default function FlyerUpload({
  current, alt,
}: { current: string | null; alt: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const isPdf = current?.toLowerCase().endsWith(".pdf");

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Seminar flyer</h2>
      <p className="mt-1 text-[15px] text-muted">
        Shown on the home page and offered as a download. Upload the same
        artwork the branch circulates on WhatsApp.
      </p>

      {current && (
        <div className="card mt-5 p-5">
          <p className="mono text-[12px] uppercase tracking-wider text-muted">Current flyer</p>
          {isPdf ? (
            <a href={current} target="_blank" rel="noreferrer"
               className="mt-3 inline-block text-[15px] text-green underline underline-offset-4">
              Open the current PDF
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={current} alt={alt ?? "Current seminar flyer"}
                 className="mt-3 max-h-[320px] w-auto rounded border border-line" />
          )}
          <button
            type="button" disabled={pending}
            className="btn-secondary mt-4 border-danger text-danger disabled:opacity-40"
            onClick={() => start(async () => {
              const res = await removeFlyer();
              setMsg(res);
            })}
          >
            Remove flyer
          </button>
        </div>
      )}

      <form
        className="card mt-5 p-5"
        action={(fd) => start(async () => {
          const res = await uploadFlyer(fd);
          setMsg(res);
          if (res?.ok) { setFileName(null); setTimeout(() => setMsg(null), 4000); }
        })}
      >
        <label className="label" htmlFor="flyer">
          {current ? "Replace the flyer" : "Upload a flyer"}
        </label>
        <input
          id="flyer" name="flyer" type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="field py-2.5"
          onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? null); setMsg(null); }}
        />
        <p className="help">JPG, PNG, WebP or PDF. Maximum 8MB. Portrait artwork is fine.</p>
        {fileName && <p className="mono mt-2 text-[13px] text-ink">{fileName}</p>}

        <label className="label mt-4" htmlFor="flyerAlt">Description for screen readers</label>
        <input
          id="flyerAlt" name="flyerAlt" className="field"
          defaultValue={alt ?? ""}
          placeholder="Seminar flyer showing the theme, date and venue"
        />
        <p className="help">
          Read aloud to anyone who cannot see the image, so repeat the key details in words.
        </p>

        {msg?.error && <p role="alert" className="mt-4 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mt-4 text-[14px] text-green">Saved. The home page is updated.</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-5 disabled:opacity-60">
          {pending ? "Uploading" : current ? "Replace flyer" : "Upload flyer"}
        </button>
      </form>
    </section>
  );
}