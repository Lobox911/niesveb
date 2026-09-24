"use client";
import { useState, useTransition } from "react";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox";
  help?: string;
  mono?: boolean;
  width?: "full" | "half";
};

export type RowShape = { id: string; summary: string; detail?: string } & Record<string, unknown>;

/**
 * One editing pattern for every list the branch maintains — categories,
 * advert placements, programme sessions. Built once rather than three times
 * so the behaviour (save, cancel, delete, inline errors) is identical
 * wherever it appears.
 */
export default function EditableList({
  title,
  description,
  rows,
  fields,
  onSave,
  onDelete,
  addLabel = "Add",
}: {
  title: string;
  description: string;
  rows: RowShape[];
  fields: FieldDef[];
  onSave: (fd: FormData) => Promise<{ ok?: boolean; error?: string } | void>;
  onDelete: (id: string) => Promise<{ ok?: boolean; error?: string } | void>;
  addLabel?: string;
}) {
  const [editing, setEditing] = useState<RowShape | "new" | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  const value = (row: RowShape | "new", name: string) =>
    row === "new" ? "" : String(row[name] ?? "");

  const checked = (row: RowShape | "new", name: string) =>
    row === "new" ? false : Boolean(row[name]);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">{title}</h2>
      <p className="mt-1 text-[15px] text-muted">{description}</p>

      {msg?.error && <p role="alert" className="mt-3 text-[14px] text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="mt-3 text-[14px] text-green">Saved.</p>}

      {rows.length > 0 && (
        <ul className="mt-5">
          {rows.map((r) => (
            <li key={r.id} className="card mb-2 flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{r.summary}</p>
                {r.detail && <p className="mono text-[13px] text-muted">{r.detail}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="btn-secondary px-3"
                  onClick={() => { setEditing(r); setMsg(null); }}>
                  Edit
                </button>
                <button
                  type="button" disabled={pending}
                  className="btn-secondary border-danger px-3 text-danger disabled:opacity-40"
                  onClick={() => start(async () => { setMsg((await onDelete(r.id)) ?? null); })}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button type="button" className="btn-primary mt-4" onClick={() => { setEditing("new"); setMsg(null); }}>
          {addLabel}
        </button>
      ) : (
        <form
          className="card mt-5 p-6"
          action={(fd) => start(async () => {
            const res = (await onSave(fd)) ?? null;
            setMsg(res);
            if (res?.ok) setEditing(null);
          })}
        >
          {editing !== "new" && <input type="hidden" name="__rowid" value={editing.id} />}
          {editing !== "new" && !fields.some((f) => f.name === "id") && (
            <input type="hidden" name="id" value={editing.id} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.width === "half" ? "" : "sm:col-span-2"}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-3 pt-6 text-[15px] text-ink">
                    <input type="checkbox" name={f.name} defaultChecked={checked(editing, f.name)} />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <label className="label" htmlFor={f.name}>{f.label}</label>
                    <input
                      id={f.name}
                      name={f.name}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      className={f.mono ? "field-mono" : "field"}
                      defaultValue={value(editing, f.name)}
                    />
                    {f.help && <p className="help">{f.help}</p>}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? "Saving" : "Save"}
            </button>
            <button type="button" className="btn-secondary"
              onClick={() => { setEditing(null); setMsg(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}