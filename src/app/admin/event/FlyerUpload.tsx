"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadFlyer, removeFlyer } from "../actions";
import FileUpload from "@/components/FileUpload";

export default function FlyerUpload({
  eventId, current, alt,
}: { eventId: string; current: string | null; alt: string | null }) {
  /* The server action revalidates the cache, but this panel's `current` prop
     came down with the page and nothing asks for it again — so after a
     successful save the preview still showed the old flyer, or no flyer, and
     the button still said "Upload". It read exactly like a save that failed.
     router.refresh() re-fetches the server component and the panel catches up. */
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

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
              const res = await removeFlyer(eventId);
              setMsg(res);
              if (res?.ok) router.refresh();
            })}
          >
            Remove flyer
          </button>
        </div>
      )}

      <form
        className="card mt-5 p-5"
        action={(fd) => start(async () => {
          fd.set("eventId", eventId);
          const res = await uploadFlyer(fd);
          setMsg(res);
          if (res?.ok) {
            router.refresh();
            setTimeout(() => setMsg(null), 4000);
          }
        })}
      >
        <FileUpload
          name="flyerUrl"
          folder="flyers"
          maxMb={10}
          currentUrl={current}
          label={current ? "Replace the flyer" : "Upload a flyer"}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          help="JPG, PNG, WebP or PDF, up to 10MB. Portrait artwork is fine. The file uploads as soon as you choose it."
        />

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