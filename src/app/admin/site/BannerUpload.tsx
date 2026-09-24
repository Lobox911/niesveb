"use client";
import { useState, useTransition } from "react";
import { uploadBanner, removeBanner } from "../actions";

export default function BannerUpload({
  current, alt,
}: { current: string | null; alt: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Inner page banner</h2>
      <p className="mt-1 text-[15px] text-muted">
        Sits behind the title on Register, Certificate, Photo card, Retrieve
        code and Programme. A dark overlay is always applied, so any image
        works — a wide landscape reads best.
      </p>

      {current && (
        <div className="card mt-5 p-5">
          <p className="mono text-[12px] uppercase tracking-wider text-muted">Current</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={alt ?? ""} className="mt-2 h-28 w-full rounded border border-line object-cover" />
          <button
            type="button" disabled={pending}
            className="btn-secondary mt-4 border-danger text-danger disabled:opacity-40"
            onClick={() => start(async () => { setMsg(await removeBanner()); })}
          >
            Remove banner
          </button>
        </div>
      )}

      <form
        className="card mt-5 p-5"
        action={(fd) => start(async () => {
          const res = await uploadBanner(fd);
          setMsg(res);
          if (res?.ok) setTimeout(() => setMsg(null), 4000);
        })}
      >
        <label className="label" htmlFor="bannerImage">
          {current ? "Replace the banner" : "Upload a banner"}
        </label>
        <input id="bannerImage" name="bannerImage" type="file"
          accept="image/jpeg,image/png,image/webp" className="field py-2.5" />
        <p className="help">JPG, PNG or WebP, maximum 5MB. Around 1600 by 400.</p>

        <label className="label mt-4" htmlFor="bannerImageAlt">Image description</label>
        <input id="bannerImageAlt" name="bannerImageAlt" className="field" defaultValue={alt ?? ""} />

        {msg?.error && <p role="alert" className="mt-3 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mt-3 text-[14px] text-green">Saved.</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-5 disabled:opacity-60">
          {pending ? "Uploading" : "Save banner"}
        </button>
      </form>
    </section>
  );
}