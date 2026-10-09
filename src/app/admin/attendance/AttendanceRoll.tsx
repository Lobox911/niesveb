"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearAttendance, markAttendanceById } from "../actions";

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

  // Tapping a name is the fast path at the desk, but a mis-tap would mark the
  // wrong person and there is no undo, so the row asks once before writing.
  // Two taps on the right person beats one tap on the wrong one.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const mark = (id: string) =>
    start(async () => {
      const res = await markAttendanceById(id);
      setConfirming(null);
      if (!("ok" in res)) {
        setError(res.error);
        setNote(null);
        return;
      }
      setError(null);
      setNote(
        res.repeat
          ? `${res.name} was already present. The second scan has been recorded.`
          : `${res.name} marked present.`,
      );
      // Refresh so the counts and the roll reflect the new record.
      router.refresh();
      setTimeout(() => setNote(null), 5000);
    });

  /* The repair for a mis-tap. It sits behind the same confirm step as marking
     someone present, because taking a name off the roll is at least as
     consequential as putting one on it. */
  const unmark = (id: string) =>
    start(async () => {
      const res = await clearAttendance(id);
      setConfirming(null);
      if (!("ok" in res)) {
        setError(res.error);
        setNote(null);
        return;
      }
      setError(null);
      setNote(`${res.name} is no longer marked present.`);
      router.refresh();
      setTimeout(() => setNote(null), 5000);
    });

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

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
            <dd className="mono mt-2 text-[26px] text-ink sm:text-[34px]">{s.value}</dd>
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

        <div role="group" aria-label="Filter the roll" className="flex w-full rounded border border-line bg-white sm:w-auto">
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
              className={`min-h-[44px] flex-1 px-3 text-[14px] sm:flex-none sm:px-4 ${
                view === v ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {note && (
        <p role="status" className="mt-4 rounded border border-green bg-green/10 p-4 text-[15px] text-green">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded border border-danger bg-white p-4 text-[15px] text-danger">
          {error}
        </p>
      )}

      <p className="help mt-4">
        Tap a name to mark them present. The passcode box above is for scanning
        the QR code on a participant card.
      </p>

      {/* The roll is used standing up, on a phone, at a desk. Cards with a
          big tap target beat a five-column table that scrolls sideways. */}
      <ul className="mt-3 space-y-2 lg:hidden">
        {shown.length === 0 && (
          <li className="card p-8 text-center text-[15px] text-muted">
            {rows.length === 0
              ? "No confirmed registrations yet. Confirm payments and codes will be issued."
              : "Nobody matches that."}
          </li>
        )}
        {shown.map((r) => {
          const asking = confirming === r.id;
          return (
            <li key={r.id} className={`card p-4 ${asking ? "border-green bg-green/5" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-medium text-ink">{r.name}</p>
                  <p className="mono mt-1 text-[13px] text-muted">
                    {r.passcode}{r.membershipNo ? ` · ${r.membershipNo}` : ""}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    {r.category} · {r.mode}
                  </p>
                </div>
                {r.scans > 0 && !asking && (
                  <span className="shrink-0 text-right">
                    <span className="mono block text-[14px] text-green">{time(r.firstSeen)}</span>
                    {r.scans > 1 && (
                      <span className="mono block text-[12px] text-gold">{r.scans} scans</span>
                    )}
                  </span>
                )}
              </div>

              {asking ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button" disabled={pending}
                    className="btn-primary min-h-[48px] flex-1 disabled:opacity-60"
                    onClick={() => mark(r.id)}
                  >
                    {pending ? "Marking" : r.scans > 0 ? "Mark again" : "Confirm present"}
                  </button>
                  {r.scans > 0 && (
                    <button
                      type="button" disabled={pending}
                      className="btn-secondary min-h-[48px] px-4 border-danger text-danger disabled:opacity-50"
                      onClick={() => unmark(r.id)}
                    >
                      Not arrived
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary min-h-[48px] px-5"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary mt-4 min-h-[48px] w-full"
                  onClick={() => { setConfirming(r.id); setError(null); }}
                >
                  {r.scans > 0 ? "Mark present again" : "Mark present"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card mt-3 hidden overflow-x-auto lg:block">
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
            {shown.map((r) => {
              const asking = confirming === r.id;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-line last:border-b-0 ${
                    asking ? "bg-green/5" : r.scans > 0 ? "" : "cursor-pointer hover:bg-paper"
                  }`}
                  onClick={() => { if (!asking) { setConfirming(r.id); setError(null); } }}
                >
                  <th scope="row" className="whitespace-nowrap px-4 py-3 text-[15px] font-medium text-ink">
                    {r.name}
                    {r.membershipNo && (
                      <span className="mono ml-2 text-[12px] text-muted">{r.membershipNo}</span>
                    )}
                  </th>
                  <td className="mono whitespace-nowrap px-4 py-3 text-[14px] text-muted">{r.passcode}</td>
                  <td className="px-4 py-3 text-[14px] text-muted">{r.category}</td>
                  <td className="px-4 py-3 text-[14px] capitalize text-muted">{r.mode}</td>

                  <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {asking ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button" disabled={pending}
                          className="btn-primary px-4 py-1.5 text-[14px] disabled:opacity-60"
                          onClick={() => mark(r.id)}
                        >
                          {pending ? "Marking" : r.scans > 0 ? "Mark again" : "Confirm present"}
                        </button>
                        {r.scans > 0 && (
                          <button
                            type="button" disabled={pending}
                            className="btn-secondary border-danger px-3 py-1.5 text-[14px] text-danger disabled:opacity-50"
                            onClick={() => unmark(r.id)}
                          >
                            Not arrived
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-[14px]"
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : r.scans > 0 ? (
                      <span className="text-[14px] text-green">
                        {time(r.firstSeen)}
                        {/* A second scan is not an error, but it is worth
                            seeing: usually somebody scanned twice,
                            occasionally it means a code is being shared. */}
                        {r.scans > 1 && (
                          <span className="mono ml-2 text-[12px] text-gold">{r.scans} scans</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[14px] text-muted">Tap to mark present</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a className="btn-secondary min-h-[44px] flex-1 text-center sm:flex-none" href="/api/export/registrations?attended=1">
          Export those present
        </a>
        <a className="btn-secondary min-h-[44px] flex-1 text-center sm:flex-none" href="/api/export/registrations?status=confirmed">
          Export the full roll
        </a>
      </div>
    </section>
  );
}