"use client";
import { useRef, useState, useTransition } from "react";
import { markAttendance } from "../actions";

type Result = { name: string; passcode: string; repeat: boolean };

/**
 * Operated one-handed at a registration table, often on a phone. Hence the
 * oversized input, the large confirmation, and focus returning to the field
 * after every scan so the officer never has to tap twice.
 */
export default function AttendanceDesk({ markedCount }: { markedCount: number }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Result[]>([]);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const format = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
  };

  const submit = () => start(async () => {
    const res = await markAttendance(code);
    if (res?.error) { setError(res.error); setResult(null); }
    else if (res?.ok) {
      const r = { name: res.name, passcode: res.passcode, repeat: res.repeat };
      setResult(r); setError(null);
      setRecent((prev) => [r, ...prev].slice(0, 8));
      setCode("");
    }
    input.current?.focus();
  });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="card p-6">
          <label className="label text-[15px]" htmlFor="code">Passcode</label>
          <input
            ref={input} id="code" autoFocus autoComplete="off"
            className="field-mono h-[64px] text-[28px] tracking-[0.18em]"
            value={code} placeholder="EBY4-9K7C"
            onChange={(e) => { setCode(format(e.target.value)); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <button type="button" onClick={submit} disabled={pending || code.length < 9}
            className="btn-primary mt-4 h-[56px] w-full text-[17px] disabled:opacity-40">
            {pending ? "Checking" : "Mark present"}
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded border border-danger bg-white p-5">
            <p className="text-[17px] text-danger">{error}</p>
          </div>
        )}

        {result && (
          <div role="status" className={`mt-5 rounded border p-6 ${result.repeat ? "border-gold bg-gold/5" : "border-green bg-green/5"}`}>
            <p className="mono text-[12px] uppercase tracking-wider text-muted">
              {result.repeat ? "Already marked earlier" : "Attendance recorded"}
            </p>
            <p className="mt-2 text-[34px] leading-tight text-ink">{result.name}</p>
            <p className="mono mt-1 text-[14px] text-muted">{result.passcode}</p>
          </div>
        )}
      </div>

      <aside>
        <div className="card p-5">
          <p className="mono text-[12px] uppercase tracking-wider text-muted">Marked so far</p>
          <p className="mono mt-2 text-[34px] text-ink">{markedCount + recent.filter((r) => !r.repeat).length}</p>
        </div>

        {recent.length > 0 && (
          <div className="mt-5">
            <h2 className="mono text-[12px] uppercase tracking-wider text-muted">This session</h2>
            <ul className="mt-3">
              {recent.map((r, i) => (
                <li key={`${r.passcode}-${i}`} className="border-b border-line py-2.5 last:border-b-0">
                  <p className="text-[15px] text-ink">{r.name}</p>
                  <p className="mono text-[12px] text-muted">{r.passcode}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
