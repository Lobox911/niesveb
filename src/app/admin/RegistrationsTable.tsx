"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmManyPayments, confirmPayment, markAttendanceById, rejectPayment, resendPasscodeEmail } from "./actions";

type Row = {
  id: string; passcode: string | null; title: string | null; surname: string; firstName: string;
  membershipNo: string | null; email: string; phone: string; firm: string | null;
  categoryId: string; mode: string; amount: string; txnRef: string | null;
  proofUrl: string | null; status: string; rejectionReason: string | null; createdAt: string;
  categoryName: string;
  scans: number; firstSeen: string | null; certificateSerial: string | null;
};

const STATUS_TONE: Record<string, string> = {
  confirmed: "border-green/40 bg-green/10 text-green",
  pending: "border-gold/40 bg-gold/10 text-gold",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

export default function RegistrationsTable({
  rows, categories, total, page, pageSize, query,
}: {
  rows: Row[];
  categories: { id: string; name: string }[];
  total: number; page: number; pageSize: number;
  query: { q?: string; status?: string; category?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState<Row | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [bulkNote, setBulkNote] = useState<string | null>(null);

  // Only pending rows can be confirmed, so the header checkbox and the count
  // both work from that set rather than from everything on screen.
  const selectable = rows.filter((r) => r.status === "pending");
  const chosen = selectable.filter((r) => picked.has(r.id));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.push(`/admin?${next.toString()}`);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mt-10 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="search">Search registrations</label>
          <input
            id="search"
            className="field"
            defaultValue={query.q ?? ""}
            placeholder="Passcode, name, membership number or reference"
            onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          />
        </div>

        <div role="group" aria-label="Filter by status" className="flex rounded border border-line bg-white">
          {[["", "All"], ["pending", "Awaiting"], ["confirmed", "Confirmed"], ["rejected", "Rejected"]].map(([v, l]) => (
            <button
              key={l}
              type="button"
              aria-pressed={(query.status ?? "") === v}
              onClick={() => setParam("status", v)}
              className={`min-h-[44px] px-4 text-[14px] ${
                (query.status ?? "") === v ? "bg-ink text-white" : "text-ink hover:bg-paper"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="cat">Category</label>
          <select
            id="cat" className="field" defaultValue={query.category ?? ""}
            onChange={(e) => setParam("category", e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Export reflects the filters above it, so "confirmed only" or one
          category is one click rather than a spreadsheet edit afterwards. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          className="btn-secondary min-h-[44px] flex-1 text-center sm:flex-none"
          href={`/api/export/registrations?${new URLSearchParams(
            Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as Record<string, string>,
          ).toString()}`}
        >
          Export these to CSV
        </a>
        <a className="btn-secondary min-h-[44px] flex-1 text-center sm:flex-none" href="/api/export/registrations?attended=1">
          Export attendance list
        </a>
      </div>

      {chosen.length > 0 && (
        <div
          role="status"
          className="sticky top-2 z-20 mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-green bg-white p-4 shadow-none"
        >
          <p className="text-[15px] text-ink">
            {chosen.length} {chosen.length === 1 ? "registration" : "registrations"} selected
            <span className="help mt-0.5 block">
              Confirming issues each participation code and emails it. There is
              no undo.
            </span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-4" onClick={() => setPicked(new Set())}>
              Clear
            </button>
            <button
              type="button"
              disabled={bulkPending}
              className="btn-primary px-5 disabled:opacity-60"
              onClick={() => startBulk(async () => {
                const ids = chosen.map((r) => r.id);
                const res = await confirmManyPayments(ids);
                setPicked(new Set());
                setBulkNote(
                  res?.error
                    ? res.error
                    : `Confirmed ${res?.count ?? ids.length}. Codes have been issued and emailed.`,
                );
                setTimeout(() => setBulkNote(null), 6000);
              })}
            >
              {bulkPending ? "Confirming" : `Confirm ${chosen.length}`}
            </button>
          </div>
        </div>
      )}

      {bulkNote && (
        <p role="status" className="mt-4 rounded border border-line bg-paper p-4 text-[15px] text-ink">
          {bulkNote}
        </p>
      )}

      {/* Phones get cards, not a table.
          Horizontally scrolling a nine-column table pushed the participant's
          name — the only column anyone is actually looking for — off the left
          edge, leaving a view of "…ICE / STATUS / REGISTERED". */}
      <ul className="mt-5 space-y-3 lg:hidden">
        {rows.length === 0 && (
          <li className="card p-8 text-center text-[15px] text-muted">
            No registrations match these filters.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpen(r)}
              className="card flex w-full items-start justify-between gap-3 p-4 text-left active:bg-paper"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium text-ink">
                  {[r.title, r.firstName, r.surname].filter(Boolean).join(" ")}
                </span>
                <span className="mono mt-1 block text-[13px] text-muted">
                  {r.passcode ?? "No code yet"} · {r.categoryName}
                </span>
                <span className="mt-1 block text-[13px] text-muted">
                  {r.amount} · {r.mode} · {new Date(r.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                </span>
              </span>
              <span className={`mono shrink-0 rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                {r.status}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="card mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Registrations, newest first</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all awaiting confirmation on this page"
                  disabled={selectable.length === 0}
                  checked={allChosen}
                  onChange={() =>
                    setPicked(allChosen ? new Set() : new Set(selectable.map((r) => r.id)))
                  }
                />
              </th>
              {["Passcode", "Name", "Category", "Mode", "Amount", "Reference", "Status", "Registered"].map((h) => (
                <th key={h} scope="col" className="mono whitespace-nowrap px-4 py-3 text-[12px] uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-[15px] text-muted">
                No registrations match these filters.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setOpen(r)}
                onKeyDown={(e) => { if (e.key === "Enter") setOpen(r); }}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-paper focus:bg-paper"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {r.status === "pending" && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.firstName} ${r.surname}`}
                      checked={picked.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                </td>
                <th scope="row" className="mono whitespace-nowrap px-4 py-3 text-[14px] font-normal text-ink">
                  {r.passcode ?? <span className="text-muted">Not issued</span>}
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-medium text-ink">
                  {[r.title, r.firstName, r.surname].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 text-[14px] text-muted">{r.categoryName}</td>
                <td className="px-4 py-3 text-[14px] capitalize text-muted">{r.mode}</td>
                <td className="mono whitespace-nowrap px-4 py-3 text-right text-[14px] text-ink">{r.amount}</td>
                <td className="mono px-4 py-3 text-[13px] text-muted">{r.txnRef || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`mono rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="mono whitespace-nowrap px-4 py-3 text-[13px] text-muted">
                  {new Date(r.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="mono text-[13px] text-muted">
          {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="btn-secondary min-h-[44px] px-4 disabled:opacity-40"
            onClick={() => setParam("page", String(page - 1))}>Previous</button>
          <button type="button" disabled={page >= pages} className="btn-secondary min-h-[44px] px-4 disabled:opacity-40"
            onClick={() => setParam("page", String(page + 1))}>Next</button>
        </div>
      </div>

      {open && <VerificationDrawer row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function VerificationDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  if (issued) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="flex-1 bg-ink/40" onClick={onClose} aria-hidden />
        <div role="dialog" aria-label="Payment confirmed" className="w-full border-line bg-white p-6 sm:max-w-[560px] sm:border-l">
          <p className="mono inline-flex rounded border border-green/40 bg-green/10 px-3 py-1.5 text-[12px] uppercase tracking-wider text-green">
            Payment confirmed
          </p>
          <h2 className="mt-4 text-[20px] text-ink">
            {[row.title, row.firstName, row.surname].filter(Boolean).join(" ")}
          </h2>
          <p className="mt-1 text-[15px] text-muted">Participation code</p>
          <p className="mono mt-2 select-all text-[34px] tracking-[0.2em] text-ink">{issued}</p>
          <p className="help mt-4">
            Emailed to {row.email}. Read it out or write it down if they are
            waiting at the desk.
          </p>
          <button type="button" onClick={onClose} className="btn-primary mt-8">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-ink/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Registration details" className="w-full overflow-y-auto border-line bg-white sm:max-w-[560px] sm:border-l">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 className="text-[20px] text-ink">Registration details</h2>
            <p className="mono mt-1 text-[14px] text-muted">
              {row.passcode ?? "Code issued on confirmation"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary px-3">Close</button>
        </div>

        <div className="p-6">
          <h3 className="mono text-[12px] uppercase tracking-wider text-muted">Participant</h3>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-[15px]">
            {[
              ["Name", [row.title, row.firstName, row.surname].filter(Boolean).join(" ")],
              ["Membership no.", row.membershipNo ?? "—"],
              ["Email", row.email],
              ["Phone", row.phone],
              ["Firm", row.firm ?? "—"],
              ["Mode", row.mode],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="text-ink break-words">{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mono mt-8 text-[12px] uppercase tracking-wider text-muted">Payment declaration</h3>
          <div className="card mt-3 p-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[14px] text-muted">Declared amount</span>
              <span className="mono text-[26px] text-ink">{row.amount}</span>
            </div>
            {row.txnRef && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[13px] text-muted">Bank reference / teller no.</p>
                <p className="mono mt-1 select-all text-[15px] text-ink">{row.txnRef}</p>
              </div>
            )}
          </div>

          <h3 className="mono mt-8 text-[12px] uppercase tracking-wider text-muted">Progress</h3>
          {/* The whole journey on one line. Previously an officer had to open
              the dashboard to see payment, the attendance page to see whether
              the person had arrived, and had no way at all to see whether a
              certificate had been issued. */}
          <ol className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "Registered", done: true, note: new Date(row.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" }) },
              { label: "Paid", done: row.status === "confirmed", note: row.status === "rejected" ? "Rejected" : row.status === "confirmed" ? "Confirmed" : "Awaiting" },
              { label: "Attended", done: row.scans > 0, note: row.scans > 0 ? (row.firstSeen ? new Date(row.firstSeen).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false }) : "Yes") : "Not yet" },
              { label: "Certificate", done: !!row.certificateSerial, note: row.certificateSerial ? "Issued" : "Not issued" },
            ].map((step) => (
              <li key={step.label} className={`rounded border-t-2 bg-paper px-3 py-2.5 ${step.done ? "border-t-green" : "border-t-line"}`}>
                <p className={`text-[13px] ${step.done ? "text-ink" : "text-muted"}`}>{step.label}</p>
                <p className="mono mt-0.5 text-[12px] text-muted">{step.note}</p>
              </li>
            ))}
          </ol>

          {row.certificateSerial && (
            <p className="help mt-2">
              Serial <span className="mono text-ink">{row.certificateSerial}</span>
            </p>
          )}

          <h3 className="mono mt-8 text-[12px] uppercase tracking-wider text-muted">Proof of payment</h3>
          {row.proofUrl ? (
            <a href={row.proofUrl} target="_blank" rel="noreferrer" className="mt-3 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.proofUrl} alt="Proof of payment uploaded by the participant" className="w-full rounded border border-line" />
              <span className="mt-2 inline-block text-[14px] text-green underline underline-offset-4">Open full size</span>
            </a>
          ) : (
            <p className="mt-3 rounded border border-line bg-paper p-4 text-[14px] text-muted">
              No document uploaded. Check this payment against the bank statement before confirming it.
            </p>
          )}

          {row.status === "rejected" && row.rejectionReason && (
            <div className="mt-6 rounded border border-danger bg-white p-4">
              <p className="text-[13px] text-muted">Rejection reason sent to the participant</p>
              <p className="mt-1 text-[15px] text-ink">{row.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Everything an officer might need to do for this person, here,
            rather than on three different screens. */}
        {row.status === "confirmed" && (
          <div className="border-t border-line px-6 py-5">
            <h3 className="mono text-[12px] uppercase tracking-wider text-muted">On the day</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button" disabled={pending}
                className="btn-secondary px-4 disabled:opacity-50"
                onClick={() => start(async () => {
                  const res = await markAttendanceById(row.id);
                  // Narrow on the success key: the failure shape has only
                  // `error`, so checking for `error` does not narrow it.
                  if (!("ok" in res)) {
                    setError(res.error);
                    setNote(null);
                    return;
                  }
                  setError(null);
                  setNote(
                    res.repeat
                      ? `${res.name} was already marked present. The second scan has been recorded too.`
                      : `${res.name} marked present.`,
                  );
                })}
              >
                {row.scans > 0 ? "Mark present again" : "Mark present"}
              </button>

              <button
                type="button" disabled={pending}
                className="btn-secondary px-4 disabled:opacity-50"
                onClick={() => start(async () => {
                  const res = await resendPasscodeEmail(row.id);
                  // Narrow on the success key: the failure shape has only
                  // `error`, so checking for `error` does not narrow it.
                  if (!("ok" in res)) {
                    setError(res.error);
                    setNote(null);
                    return;
                  }
                  setError(null);
                  setNote(`Code resent to ${res.email}.`);
                })}
              >
                Resend their code
              </button>
            </div>
            {note && <p role="status" className="mt-3 text-[14px] text-green">{note}</p>}
          </div>
        )}

        <div className="sticky bottom-0 border-t border-line bg-white p-6">
          {error && <p role="alert" className="mb-3 text-[14px] text-danger">{error}</p>}

          {rejecting ? (
            <>
              <label className="label" htmlFor="reason">Reason for rejection</label>
              <textarea
                id="reason" rows={3} className="field py-2" value={reason}
                onChange={(e) => { setReason(e.target.value); setError(null); }}
              />
              <p className="help">This text is emailed to the participant exactly as written.</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button" disabled={pending}
                  className="btn-secondary flex-1 border-danger text-danger"
                  onClick={() => start(async () => {
                    const res = await rejectPayment(row.id, reason);
                    if (res?.error) setError(res.error); else onClose();
                  })}
                >
                  Confirm rejection
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setRejecting(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                type="button" disabled={pending || row.status === "confirmed"}
                className="btn-primary flex-1 disabled:opacity-40"
                onClick={() => start(async () => {
                  const res = await confirmPayment(row.id);
                  // Shown rather than closing straight away: someone paying at
                  // the desk is standing there waiting, and will not check an
                  // inbox before the registrar needs to let them in.
                  if (res?.passcode) setIssued(res.passcode);
                  else onClose();
                })}
              >
                {row.status === "confirmed" ? "Already confirmed" : "Confirm payment"}
              </button>
              <button type="button" className="btn-secondary border-danger text-danger" onClick={() => setRejecting(true)}>
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}