"use client";
import { useState, useTransition } from "react";
import FileUpload from "@/components/FileUpload";
import { createPage, deletePage, movePage, updatePage } from "../actions";

type Slot = { key: string; label: string; help?: string; long?: boolean; value: string };

type Row = {
  id: string; slug: string; kind: string; title: string; intro: string; body: string;
  copy: string; navLabel: string; showInNav: boolean; navOrder: number;
  metaTitle: string; metaDescription: string;
  bannerImageUrl: string | null; bannerImageAlt: string;
  published: boolean; path: string; purpose: string;
};

function parseCopy(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export default function PagesManager({
  rows, slots,
}: { rows: Row[]; slots: Record<string, Slot[]> }) {
  const [open, setOpen] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <>
      {notice?.error && (
        <p role="alert" className="mt-6 rounded border border-danger bg-white p-4 text-[15px] text-danger">
          {notice.error}
        </p>
      )}
      {notice?.ok && (
        <p className="mt-6 rounded border border-green/40 bg-green/10 p-4 text-[15px] text-green">Saved.</p>
      )}

      <div className="mt-8 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          Add a page
        </button>
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-line bg-paper">
            <tr>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Page</th>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Address</th>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">In menu</th>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Status</th>
              <th scope="col" className="mono px-4 py-3 text-right text-[12px] uppercase tracking-wider text-muted">Order</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.id}>
                <th scope="row" className="px-4 py-3 text-[15px] font-normal text-ink">
                  {r.title}
                  {r.kind === "system" && (
                    <span className="mono ml-2 rounded border border-line px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-muted">
                      Built in
                    </span>
                  )}
                </th>
                <td className="mono px-4 py-3 text-[13px] text-muted">{r.path}</td>
                <td className="px-4 py-3 text-[14px] text-muted">
                  {r.showInNav ? (r.navLabel || r.title) : "Hidden"}
                </td>
                <td className="px-4 py-3">
                  <span className={`mono rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider ${
                    r.published
                      ? "border-green/40 bg-green/10 text-green"
                      : "border-gold/40 bg-gold/10 text-gold"
                  }`}>
                    {r.published ? "Live" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button" aria-label={`Move ${r.title} up`} disabled={pending || i === 0}
                      className="btn-secondary px-2.5 py-1 text-[13px] disabled:opacity-30"
                      onClick={() => start(async () => { await movePage(r.id, "up"); })}
                    >↑</button>
                    <button
                      type="button" aria-label={`Move ${r.title} down`} disabled={pending || i === rows.length - 1}
                      className="btn-secondary px-2.5 py-1 text-[13px] disabled:opacity-30"
                      onClick={() => start(async () => { await movePage(r.id, "down"); })}
                    >↓</button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="btn-secondary px-3 py-1.5 text-[14px]"
                    onClick={() => { setNotice(null); setOpen(r); }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="help mt-4 max-w-[640px]">
        Built-in pages carry the registration form, the passcode gates and the
        certificate, so they cannot be deleted. Untick <em>Show in menu</em> to
        take one out of the navigation while leaving it reachable by its
        address.
      </p>

      {adding && (
        <AddPage
          pending={pending}
          onClose={() => setAdding(false)}
          onSubmit={(fd) => start(async () => {
            const res = await createPage(fd);
            setNotice(res?.error ? { error: res.error } : { ok: true });
            if (!res?.error) setAdding(false);
          })}
        />
      )}

      {open && (
        <EditPage
          row={open}
          slots={slots[open.slug] ?? []}
          pending={pending}
          onClose={() => setOpen(null)}
          onDelete={() => start(async () => {
            const res = await deletePage(open.id);
            setNotice(res?.error ? { error: res.error } : { ok: true });
            if (!res?.error) setOpen(null);
          })}
          onSubmit={(fd) => start(async () => {
            const res = await updatePage(fd);
            setNotice(res?.error ? { error: res.error } : { ok: true });
            if (!res?.error) setOpen(null);
          })}
        />
      )}
    </>
  );
}

function Drawer({ label, children, onClose }: {
  label: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-ink/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={label}
        className="w-full max-w-[640px] overflow-y-auto border-l border-line bg-white">
        {children}
      </div>
    </div>
  );
}

function AddPage({ pending, onClose, onSubmit }: {
  pending: boolean; onClose: () => void; onSubmit: (fd: FormData) => void;
}) {
  return (
    <Drawer label="Add a page" onClose={onClose}>
      <form action={onSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <h2 className="text-[20px] text-ink">Add a page</h2>
          <button type="button" onClick={onClose} className="btn-secondary px-3">Close</button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="label" htmlFor="new-title">Page name</label>
            <input id="new-title" name="title" className="field" placeholder="Example: About the branch" />
            <p className="help">Shown as the heading and, unless you change it, in the menu.</p>
          </div>

          <div>
            <label className="label" htmlFor="new-slug">Web address</label>
            <input id="new-slug" name="slug" className="field-mono" placeholder="about-the-branch" />
            <p className="help">
              Leave blank to build one from the name. Letters, numbers and
              hyphens only.
            </p>
          </div>

          <label className="flex items-start gap-3 text-[15px] text-ink">
            <input type="checkbox" name="showInNav" defaultChecked className="mt-1" />
            <span>Show in the menu once published</span>
          </label>

          <p className="help">
            The page is created as a draft. Write it, then tick <em>Published</em>
            {" "}to put it on the site.
          </p>
        </div>

        <div className="border-t border-line p-6">
          <button type="submit" disabled={pending} className="btn-primary min-h-[46px] px-6 disabled:opacity-60">
            {pending ? "Creating" : "Create page"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function EditPage({ row, slots, pending, onClose, onSubmit, onDelete }: {
  row: Row; slots: Slot[]; pending: boolean;
  onClose: () => void; onSubmit: (fd: FormData) => void; onDelete: () => void;
}) {
  const copy = parseCopy(row.copy);
  const [confirming, setConfirming] = useState(false);

  return (
    <Drawer label={`Edit ${row.title}`} onClose={onClose}>
      <form action={onSubmit}>
        <input type="hidden" name="id" value={row.id} />

        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 className="text-[20px] text-ink">{row.title}</h2>
            <p className="mono mt-1 text-[13px] text-muted">{row.path}</p>
            {row.purpose && <p className="mt-2 max-w-[440px] text-[14px] text-muted">{row.purpose}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-secondary px-3">Close</button>
        </div>

        <div className="space-y-6 p-6">
          <fieldset className="card p-5">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Menu and visibility</legend>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="title">Page name</label>
                <input id="title" name="title" className="field" defaultValue={row.title} />
              </div>
              <div>
                <label className="label" htmlFor="navLabel">Menu label</label>
                <input id="navLabel" name="navLabel" className="field" defaultValue={row.navLabel}
                  placeholder={row.title} />
                <p className="help">Blank uses the page name. Keep it short — long labels wrap the menu.</p>
              </div>
              <input type="hidden" name="navOrder" value={row.navOrder} />

              <label className="flex items-start gap-3 text-[15px] text-ink">
                <input type="checkbox" name="showInNav" defaultChecked={row.showInNav} className="mt-1" />
                <span>Show in the menu</span>
              </label>

              <label className="flex items-start gap-3 text-[15px] text-ink">
                <input type="checkbox" name="published" defaultChecked={row.published} className="mt-1" />
                <span>
                  Published
                  {row.kind === "system" && (
                    <span className="help mt-0.5 block">
                      Unpublishing a built-in page removes it from the menu but
                      the address keeps working, because the form or gate behind
                      it is still there.
                    </span>
                  )}
                </span>
              </label>
            </div>
          </fieldset>

          {row.kind === "system" ? (
            <fieldset className="card p-5">
              <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Wording</legend>
              <p className="help mb-4">
                Leave a box empty to use the wording the site ships with, shown
                in grey.
              </p>
              <div className="space-y-4">
                {slots.map((s) => (
                  <div key={s.key}>
                    <label className="label" htmlFor={`copy-${s.key}`}>{s.label}</label>
                    {s.long ? (
                      <textarea id={`copy-${s.key}`} name={`copy.${s.key}`} rows={3}
                        className="field py-2" defaultValue={copy[s.key] ?? ""} placeholder={s.value} />
                    ) : (
                      <input id={`copy-${s.key}`} name={`copy.${s.key}`} className="field"
                        defaultValue={copy[s.key] ?? ""} placeholder={s.value} />
                    )}
                    {s.help && <p className="help">{s.help}</p>}
                  </div>
                ))}
              </div>
            </fieldset>
          ) : (
            <fieldset className="card p-5">
              <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Content</legend>
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="intro">Introduction</label>
                  <textarea id="intro" name="intro" rows={2} className="field py-2" defaultValue={row.intro} />
                  <p className="help">One or two sentences under the heading.</p>
                </div>
                <div>
                  <label className="label" htmlFor="body">Body</label>
                  <textarea id="body" name="body" rows={16} className="field py-2 font-mono text-[14px]"
                    defaultValue={row.body} />
                  <p className="help">
                    Leave a blank line between paragraphs. Start a line with
                    <span className="mono"> ## </span> to make it a heading.
                  </p>
                </div>
                <div>
                  {row.bannerImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={row.bannerImageUrl} alt="Current banner"
                      className="mb-2 h-24 w-full rounded border border-line object-cover" />
                  )}
                  <FileUpload
                    name="bannerImageUrl"
                    folder="page-banners"
                    currentUrl={row.bannerImageUrl}
                    label="Banner image"
                    accept="image/jpeg,image/png,image/webp"
                    help="Optional. Blank uses the site-wide banner."
                  />
                </div>
                <div>
                  <label className="label" htmlFor="bannerImageAlt">Banner description</label>
                  <input id="bannerImageAlt" name="bannerImageAlt" className="field"
                    defaultValue={row.bannerImageAlt} />
                </div>
              </div>
            </fieldset>
          )}

          <fieldset className="card p-5">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Search</legend>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="metaTitle">Search title</label>
                <input id="metaTitle" name="metaTitle" className="field" defaultValue={row.metaTitle}
                  placeholder={row.title} />
                <p className="help">Around 60 characters. Blank uses the page name.</p>
              </div>
              <div>
                <label className="label" htmlFor="metaDescription">Search description</label>
                <textarea id="metaDescription" name="metaDescription" rows={3} className="field py-2"
                  defaultValue={row.metaDescription} />
                <p className="help">
                  Around 155 characters. This is the paragraph under the title
                  in Google results, and it should differ from every other page.
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line p-6">
          <button type="submit" disabled={pending} className="btn-primary min-h-[46px] px-6 disabled:opacity-60">
            {pending ? "Saving" : "Save changes"}
          </button>

          {row.kind === "custom" && (
            confirming ? (
              <div className="text-right">
                <p className="text-[14px] text-danger">Delete this page for good?</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={onDelete} disabled={pending}
                    className="btn bg-danger px-4 text-white disabled:opacity-60">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn-secondary px-4">
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}
                className="btn-secondary border-danger px-4 text-danger">
                Delete page
              </button>
            )
          )}
        </div>
      </form>
    </Drawer>
  );
}