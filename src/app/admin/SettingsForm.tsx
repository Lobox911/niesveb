"use client";
import { useState, useTransition } from "react";
import { updateSettings } from "./actions";

export type Field = {
  name: string;
  label: string;
  type?: string;
  help?: string;
  mono?: boolean;
  textarea?: boolean;
};

export type Group = { legend: string; fields: Field[] };

/**
 * Shared form for both settings pages. Each page passes its own groups, and
 * updateSettings writes only the fields that were submitted — so saving the
 * site form cannot wipe the event form's values.
 */
export default function SettingsForm({
  groups, initial, submitLabel = "Save settings",
}: {
  groups: Group[];
  initial: Record<string, string>;
  submitLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <form
      className="mt-8"
      action={(fd) => start(async () => {
        const res = await updateSettings(fd);
        setMsg(res);
        if (res?.ok) setTimeout(() => setMsg(null), 4000);
      })}
    >
      {/* Group cards sit side by side on wide screens, but the fields inside
          each stay in one column — two-column form fields make the eye zigzag
          and measurably slow completion. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
      {groups.map((g) => (
        <fieldset
          key={g.legend}
          className={`card p-6 ${g.fields.some((f) => f.textarea) ? "xl:col-span-2" : ""}`}
        >
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">
            {g.legend}
          </legend>
          <div className="space-y-4">
            {g.fields.map((f) => (
              <div key={f.name}>
                <label className="label" htmlFor={f.name}>{f.label}</label>
                {f.textarea ? (
                  <textarea
                    id={f.name} name={f.name} rows={8} className="field py-2"
                    defaultValue={initial[f.name] ?? ""}
                  />
                ) : (
                  <input
                    id={f.name} name={f.name} type={f.type ?? "text"}
                    className={f.mono ? "field-mono" : "field"}
                    defaultValue={initial[f.name] ?? ""}
                  />
                )}
                {f.help && <p className="help">{f.help}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-line bg-paper py-4">
        {msg?.error && <p role="alert" className="mb-3 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mb-3 text-[14px] text-green">Saved. The public site is updated.</p>}
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}