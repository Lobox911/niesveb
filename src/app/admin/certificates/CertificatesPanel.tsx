"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { generateCertificates } from "../actions";

type Row = {
  id: string;
  name: string;
  email: string;
  passcode: string | null;
  mode: string;
  category: string;
  units: number;
  attended: boolean;
  serial: string | null;
};

/* Small enough that a batch finishes well inside the function timeout, large
   enough that two hundred people do not take all afternoon. Each certificate
   is a PDF build plus an email round trip, so this is the number that moves. */
const BATCH = 8;

type Outcome = { name: string; serial?: string; reason?: string; emailed?: boolean };

export default function CertificatesPanel({
  events, eventId, eventTitle, rows,
}: {
  events: { id: string; title: string; year: number }[];
  eventId: string;
  eventTitle: string;
  rows: Row[];
}) {
  const router = useRouter();

  const attended = useMemo(() => rows.filter((r) => r.attended), [rows]);
  const absent = useMemo(() => rows.filter((r) => !r.attended), [rows]);

  // Attended are selected on arrival; the rest have to be chosen deliberately.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(attended.map((r) => r.id)));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [issued, setIssued] = useState<Outcome[]>([]);
  const [failed, setFailed] = useState<Outcome[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chosen = rows.filter((r) => picked.has(r.id));
  const chosenAbsent = chosen.filter((r) => !r.attended);
  const alreadyHave = chosen.filter((r) => r.serial).length;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const setGroup = (group: Row[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const r of group) { if (on) next.add(r.id); else next.delete(r.id); }
      return next;
    });

  async function run() {
    setRunning(true);
    setError(null);
    setIssued([]);
    setFailed([]);

    const ids = chosen.map((r) => r.id);
    setProgress({ done: 0, total: ids.length });

    const ok: Outcome[] = [];
    const bad: Outcome[] = [];

    /* Sent a batch at a time, with the screen updated between batches. A
       single request for the whole cohort would exceed the function timeout
       and leave nobody able to say which certificates had actually gone. */
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      try {
        const res = await generateCertificates(slice, true);
        // The action returns either an error or the two lists; narrow on the
        // success key so a refused batch stops the run rather than silently
        // counting as processed.
        if (!res.ok) { setError(res.error); break; }
        ok.push(...res.done.map((d) => ({ name: d.name, serial: d.serial, emailed: d.emailed })));
        bad.push(...res.failed.map((f) => ({ name: f.name, reason: f.reason })));
      } catch {
        bad.push(...slice.map(() => ({ name: "Unknown", reason: "The request did not complete" })));
      }
      setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
      setIssued([...ok]);
      setFailed([...bad]);
    }

    setRunning(false);
    router.refresh();
  }

  const Group = ({
    label, help, list, tone,
  }: { label: string; help: string; list: Row[]; tone: "ok" | "warn" }) => {
    if (list.length === 0) return null;
    const allOn = list.every((r) => picked.has(r.id));
    return (
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className={`text-[18px] ${tone === "warn" ? "text-danger" : "text-ink"}`}>
              {label} <span className="mono text-[14px] text-muted">{list.length}</span>
            </h2>
            <p className="help mt-0.5">{help}</p>
          </div>
          <button
            type="button" disabled={running}
            className="btn-secondary px-4 disabled:opacity-50"
            onClick={() => setGroup(list, !allOn)}
          >
            {allOn ? "Deselect all" : "Select all"}
          </button>
        </div>

        <ul className="card mt-3 divide-y divide-line">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <input
                type="checkbox" checked={picked.has(r.id)} disabled={running}
                onChange={() => toggle(r.id)}
                aria-label={`Include ${r.name}`}
                className="h-4 w-4 shrink-0 accent-green"
              />
              <span className="min-w-[200px] flex-1">
                <span className="block text-[15px] text-ink">{r.name}</span>
                <span className="block text-[13px] text-muted">{r.email}</span>
              </span>
              <span className="text-[13px] text-muted">{r.category}</span>
              <span className="mono text-[12px] capitalize text-muted">{r.mode}</span>
              {r.serial ? (
                <span className="mono text-[12px] text-green">{r.serial}</span>
              ) : (
                <span className="mono text-[12px] text-muted">not issued</span>
              )}
              <a
                href={`/api/certificate/participant?id=${r.id}`}
                target="_blank" rel="noreferrer"
                className="text-[14px] text-green underline underline-offset-4"
              >
                Preview
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="event">Event</label>
          <select
            id="event" className="field min-w-[280px]" defaultValue={eventId} disabled={running}
            onChange={(e) => router.push(`/admin/certificates?event=${e.target.value}`)}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title} ({e.year})</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-[17px] text-ink">No confirmed participants</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-[15px] text-muted">
            Certificates are issued to participants whose payment has been
            confirmed. Confirm payments on the dashboard first.
          </p>
        </div>
      ) : (
        <>
          <Group
            label="Attended"
            help="Marked present at the desk. Ready to receive a certificate."
            list={attended}
            tone="ok"
          />
          <Group
            label="Not marked present"
            help="Paid, but no attendance was recorded. Tick anyone who did attend — a virtual participant, or someone the desk missed."
            list={absent}
            tone="warn"
          />

          <div className="sticky bottom-0 mt-8 border-t border-line bg-paper py-5">
            {chosenAbsent.length > 0 && (
              <p className="mb-3 rounded border border-danger bg-white p-4 text-[14px] text-ink">
                <strong>{chosenAbsent.length}</strong>{" "}
                {chosenAbsent.length === 1 ? "person has" : "people have"} no attendance
                record. The certificate awards MCPD credit units, which go into
                their record with NIESV, so only include them if you know they
                attended. This is recorded in the activity log.
              </p>
            )}

            {alreadyHave > 0 && (
              <p className="help mb-3">
                {alreadyHave} of those selected already {alreadyHave === 1 ? "has a" : "have"} certificate
                number. Running again re-sends the same document — it does not
                issue a new number.
              </p>
            )}

            {error && <p role="alert" className="mb-3 text-[14px] text-danger">{error}</p>}

            {progress && (
              <div className="mb-3">
                <p className="mono text-[13px] text-ink">
                  {progress.done} of {progress.total} processed
                  {issued.length > 0 && ` · ${issued.length} issued`}
                  {failed.length > 0 && ` · ${failed.length} failed`}
                </p>
                <div className="mt-1.5 h-1 w-full max-w-[360px] rounded bg-line">
                  <div
                    className="h-1 rounded bg-green transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={running || chosen.length === 0}
              onClick={run}
              className="btn-primary disabled:opacity-50"
            >
              {running
                ? "Sending"
                : `Generate and email ${chosen.length} ${chosen.length === 1 ? "certificate" : "certificates"}`}
            </button>
            <p className="help mt-2">
              Each participant gets their certificate as a PDF attached to an
              email. Preview one first — the wording and signatures come from
              Site settings.
            </p>
          </div>

          {failed.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[18px] text-danger">Did not go out</h2>
              <ul className="card mt-3 divide-y divide-line">
                {failed.map((f, n) => (
                  <li key={n} className="flex justify-between gap-4 px-4 py-3 text-[14px]">
                    <span className="text-ink">{f.name}</span>
                    <span className="text-muted">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {issued.length > 0 && !running && (
            <section className="mt-8">
              <h2 className="text-[18px] text-ink">
                Issued <span className="mono text-[14px] text-muted">{issued.length}</span>
              </h2>
              <ul className="card mt-3 divide-y divide-line">
                {issued.map((d, n) => (
                  <li key={n} className="flex flex-wrap justify-between gap-4 px-4 py-3 text-[14px]">
                    <span className="text-ink">{d.name}</span>
                    <span className="mono text-[13px] text-muted">{d.serial}</span>
                    <span className={d.emailed ? "text-green" : "text-danger"}>
                      {d.emailed ? "Emailed" : "Email failed — read the code out instead"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}