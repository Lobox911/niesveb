"use client";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  passcode: string;
  name: string;
  membershipNo: string;
  category: string;
  mode: string;
  scans: number;
  firstSeen: string | null;
};

/**
 * Who is in the room.
 *
 * Three questions get asked on the day, in this order: how many are here, is
 * this particular person marked, and who has not arrived. The counts answer
 * the first, search answers the second, the "not arrived" filter answers the
 * third.
 *
 * Filtering happens in the browser rather than as a page reload — the
 * registrar is on a phone at a desk with a queue in front of them, and a round
 * trip per keystroke is the difference between usable and abandoned.
 */
export default function AttendanceRoll({
  rows, expected, present,
}: { rows: Row[]; expected: number; present: number }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "present" | "absent">("all");

  const physical = rows.filter((r) => r.mode !== "virtual");
  const virtual = rows.filter((r) => r.mode === "virtual");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "present" && r.scans === 0) return false;
      if (view === "absent" && r.scans > 0) return false;
      if (!term) return true;
      return (
        r.name.toLowerCase().includes(term) ||
        r.passcode.toLowerCase().includes(term) ||
        r.membershipNo.toLowerCase().includes(term)
      );
    });
  }, [rows, q, view]);

  const pct = expected === 0 ? 0 : Math.round((present / expected) * 100);

  const time = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-NG", {
          hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos",
        }).format(new Date(iso))
      : "";

  return (
    <section className="mt-12">
      <h2 className="text-[20px] text-ink">Attendance roll</h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Expected", value: expected, tone: "ink" },
          { label: "Present", value: present, tone: "green" },
          { label: "Not yet arrived", value: expected - present, tone: "gold" },
          { label: "Turnout", value: `${pct}%`, tone: "ink" },
        ].map((s) => (
          <div
            key={s.label}
            className={`card border-l-2 p-5 ${
              s.tone === "green" ? "border-l-green" : s.tone === "gold" ? "border-l-gold" : "border-l-ink"
            }`}
          >
            <dt className="mono text-[12px] uppercase tracking-wider text-muted">{s.label}</dt>
            <dd className="mono mt-2 text-[34px] text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <p className="help mt-3">
        {physical.length} registered to attend in person, {virtual.length} online.
      </p>

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="roll-search">Find a participant</label>
          <input
            id="roll-search"
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or membership number"
          />
        </div>

        <div role="group" aria-label="Filter the roll" className="flex rounded border border-line bg-white">
          {([
            ["all", `All ${rows.length}`],
            ["present", `Present ${present}`],
            ["absent", `Not arrived ${expected - present}`],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-4 py-2.5 text-[14px] ${
                view === v ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Confirmed participants and their attendance</caption>
          <thead>
            <tr className="border-b border-line">
              {["Name", "Code", "Category", "Mode", "Arrived"].map((h) => (
                <th key={h} scope="col" className="mono whitespace-nowrap px-4 py-3 text-[12px] uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[15px] text-muted">
                  {rows.length === 0
                    ? "No confirmed registrations yet. Confirm payments and codes will be issued."
                    : "Nobody matches that."}
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="whitespace-nowrap px-4 py-3 text-[15px] font-medium text-ink">
                  {r.name}
                  {r.membershipNo && (
                    <span className="mono ml-2 text-[12px] text-muted">{r.membershipNo}</span>
                  )}
                </th>
                <td className="mono whitespace-nowrap px-4 py-3 text-[14px] text-muted">{r.passcode}</td>
                <td className="px-4 py-3 text-[14px] text-muted">{r.category}</td>
                <td className="px-4 py-3 text-[14px] capitalize text-muted">{r.mode}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.scans > 0 ? (
                    <span className="text-[14px] text-green">
                      {time(r.firstSeen)}
                      {/* A second scan is not an error, but it is worth seeing:
                          usually somebody scanned twice, occasionally it means
                          a code is being shared. */}
                      {r.scans > 1 && (
                        <span className="mono ml-2 text-[12px] text-gold">
                          {r.scans} scans
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[14px] text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a className="btn-secondary" href="/api/export/registrations?attended=1">
          Export those present
        </a>
        <a className="btn-secondary" href="/api/export/registrations?status=confirmed">
          Export the full roll
        </a>
      </div>
    </section>
  );
}