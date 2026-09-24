"use client";
import { useState, useTransition } from "react";
import { saveHeroSlide, deleteHeroSlide } from "../actions";

export type SlideRow = {
  id: string;
  eyebrow: string | null;
  title: string;
  dateLine: string | null;
  venueLine: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sortOrder: number;
  published: boolean;
};

export default function HeroSlides({ rows }: { rows: SlideRow[] }) {
  const [editing, setEditing] = useState<SlideRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Upcoming events</h2>
      <p className="mt-1 text-[15px] text-muted">
        Each event becomes a slide in the home page hero. With none published
        the page falls back to the seminar theme, so it is safe to leave empty.
      </p>

      {msg?.error && <p role="alert" className="mt-3 text-[14px] text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="mt-3 text-[14px] text-green">Saved.</p>}

      {rows.length > 0 && (
        <ul className="mt-5">
          {rows.map((r) => (
            <li key={r.id} className="card mb-3 flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{r.title}</p>
                <p className="mono text-[13px] text-muted">
                  {r.dateLine ?? "No date"} · order {r.sortOrder}
                  {!r.published && " · hidden"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="btn-secondary px-3" onClick={() => { setEditing(r); setMsg(null); }}>
                  Edit
                </button>
                <button
                  type="button" disabled={pending}
                  className="btn-secondary border-danger px-3 text-danger disabled:opacity-40"
                  onClick={() => start(async () => { setMsg(await deleteHeroSlide(r.id)); })}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button type="button" className="btn-primary mt-4" onClick={() => setEditing("new")}>
          Add an event
        </button>
      ) : (
        <form
          className="card mt-5 p-6"
          action={(fd) => start(async () => {
            const res = await saveHeroSlide(fd);
            setMsg(res);
            if (res?.ok) setEditing(null);
          })}
        >
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Event title</label>
              <input id="title" name="title" className="field" required
                defaultValue={editing === "new" ? "" : editing.title} />
              <p className="help">The headline. Keep it under about 20 words.</p>
            </div>
            <div>
              <label className="label" htmlFor="eyebrow">Small line above the title</label>
              <input id="eyebrow" name="eyebrow" className="field"
                placeholder="MCPD Seminar 2026 / Hybrid"
                defaultValue={editing === "new" ? "" : editing.eyebrow ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="dateLine">Date</label>
              <input id="dateLine" name="dateLine" className="field"
                placeholder="25-26 March 2026"
                defaultValue={editing === "new" ? "" : editing.dateLine ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="venueLine">Venue</label>
              <input id="venueLine" name="venueLine" className="field"
                defaultValue={editing === "new" ? "" : editing.venueLine ?? ""} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ctaLabel">Button text</label>
                <input id="ctaLabel" name="ctaLabel" className="field" placeholder="Register now"
                  defaultValue={editing === "new" ? "" : editing.ctaLabel ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="ctaHref">Button link</label>
                <input id="ctaHref" name="ctaHref" className="field" placeholder="/register"
                  defaultValue={editing === "new" ? "" : editing.ctaHref ?? ""} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="sortOrder">Order</label>
                <input id="sortOrder" name="sortOrder" inputMode="numeric" className="field-mono"
                  defaultValue={editing === "new" ? "0" : String(editing.sortOrder)} />
                <p className="help">Lower numbers show first.</p>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-[15px] text-ink">
                  <input type="checkbox" name="published"
                    defaultChecked={editing === "new" ? true : editing.published} />
                  Show on the site
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? "Saving" : "Save event"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setMsg(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}