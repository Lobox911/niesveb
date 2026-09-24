"use client";
import { useState, useTransition } from "react";
import { uploadLogo } from "../actions";

export default function LogoUpload({ current }: { current: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Branch crest</h2>
      <p className="mt-1 text-[15px] text-muted">
        Replaces the placeholder mark in the site header. A transparent PNG or
        an SVG works best.
      </p>

      <form
        className="card mt-5 p-5"
        action={(fd) => start(async () => { setMsg(await uploadLogo(fd)); })}
      >
        {current && (
          <div className="mb-4">
            <p className="mono text-[12px] uppercase tracking-wider text-muted">Current</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt="Current branch crest" className="mt-2 h-14 w-auto" />
          </div>
        )}
        <label className="label" htmlFor="logo">{current ? "Replace the crest" : "Upload the crest"}</label>
        <input id="logo" name="logo" type="file"
          accept="image/png,image/webp,image/svg+xml,image/jpeg"
          className="field py-2.5" />
        <p className="help">PNG, WebP, SVG or JPG. Maximum 2MB.</p>

        {msg?.error && <p role="alert" className="mt-3 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mt-3 text-[14px] text-green">Saved.</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-4 disabled:opacity-60">
          {pending ? "Uploading" : "Save crest"}
        </button>
      </form>
    </section>
  );
}