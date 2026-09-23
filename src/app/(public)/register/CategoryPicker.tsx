"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { event, formatNaira } from "@/lib/event";

/**
 * Explicit list, not a <select>. The reference site hid the fee behind a
 * dropdown, so participants guessed their category.
 */
export default function CategoryPicker({ preselect }: { preselect?: string }) {
  const router = useRouter();
  const [cat, setCat] = useState<string | undefined>(preselect);
  const [mode, setMode] = useState<"physical" | "virtual">("physical");
  const chosen = event.categories.find((c) => c.id === cat);

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
      <div>
        <h2 className="text-[20px]">Select category</h2>
        <div role="radiogroup" aria-label="Membership category" className="mt-4 space-y-3">
          {event.categories.map((c) => {
            const on = c.id === cat;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCat(c.id)}
                className={`flex w-full items-center justify-between gap-4 rounded border p-5 text-left ${
                  on ? "border-2 border-green bg-green/[0.04]" : "border-line bg-white hover:bg-paper"
                }`}
              >
                <span>
                  <span className="block text-[17px] font-semibold text-ink">{c.name}</span>
                  <span className="block text-[13px] text-muted">{c.eligibility}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="mono block text-[20px] text-ink">{formatNaira(c.fee)}</span>
                  <span className="block text-[13px] text-muted">{c.units} units</span>
                </span>
              </button>
            );
          })}
        </div>

        <h2 className="mt-10 text-[20px]">Attendance mode</h2>
        <div role="radiogroup" aria-label="Attendance mode" className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["physical", "virtual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded border p-5 text-left ${
                mode === m ? "border-2 border-green bg-green/[0.04]" : "border-line bg-white hover:bg-paper"
              }`}
            >
              <span className="block text-[17px] font-semibold capitalize text-ink">{m}</span>
              <span className="mt-1 block text-[13px] text-muted">
                {m === "physical" ? event.venue : "Join link issued with your passcode"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="card h-max p-5 lg:sticky lg:top-24">
        <h3 className="mono text-[12px] uppercase tracking-wider text-muted">Selection summary</h3>
        <dl className="mt-4 space-y-3 text-[15px]">
          <div>
            <dt className="text-muted">Category</dt>
            <dd className="text-ink">{chosen?.name ?? "Not selected"}</dd>
          </div>
          <div>
            <dt className="text-muted">Attendance</dt>
            <dd className="capitalize text-ink">{mode}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <dt className="text-[13px] text-muted">Amount due</dt>
          <dd className="mono mt-1 text-[26px] text-ink">
            {chosen ? formatNaira(chosen.fee) : "—"}
          </dd>
        </div>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => router.push(`/register/details?category=${cat}&mode=${mode}`)}
          className="btn-primary mt-5 w-full disabled:opacity-50"
        >
          Continue
        </button>
        {!chosen && <p className="help">Select a category to continue.</p>}
      </aside>
    </div>
  );
}
