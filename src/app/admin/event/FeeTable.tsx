"use client";
import { useState, useTransition } from "react";
import { updateCategoryFee } from "../actions";

type Row = { id: string; name: string; fee: number; units: number };

export default function FeeTable({ rows }: { rows: Row[] }) {
  const [draft, setDraft] = useState<Row[]>(rows);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, patch: Partial<Row>) =>
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Registration fees</h2>
      <p className="mt-1 text-[15px] text-muted">
        Amounts in naira. Saving a row updates the public fee table at once.
      </p>

      {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Editable registration fees by category</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Category</th>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Fee (₦)</th>
              <th scope="col" className="mono px-4 py-3 text-[12px] uppercase tracking-wider text-muted">Units</th>
              <th scope="col" className="mono px-4 py-3 text-right text-[12px] uppercase tracking-wider text-muted">Save</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-3 text-[15px] font-medium text-ink">{r.name}</th>
                <td className="px-4 py-2">
                  <label className="sr-only" htmlFor={`fee-${r.id}`}>{r.name} fee in naira</label>
                  <input
                    id={`fee-${r.id}`} inputMode="numeric" className="field-mono w-[120px]"
                    value={r.fee}
                    onChange={(e) => set(r.id, { fee: Number(e.target.value.replace(/\D/g, "")) })}
                  />
                </td>
                <td className="px-4 py-2">
                  <label className="sr-only" htmlFor={`units-${r.id}`}>{r.name} MCPD units</label>
                  <input
                    id={`units-${r.id}`} inputMode="numeric" className="field-mono w-[72px]"
                    value={r.units}
                    onChange={(e) => set(r.id, { units: Number(e.target.value.replace(/\D/g, "")) })}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button" disabled={pending}
                    className="btn-secondary px-3 disabled:opacity-40"
                    onClick={() => start(async () => {
                      const res = await updateCategoryFee(r.id, r.fee, r.units);
                      if (res?.error) setError(res.error);
                      else { setError(null); setSaved(r.id); setTimeout(() => setSaved(null), 2500); }
                    })}
                  >
                    {saved === r.id ? "Saved" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}