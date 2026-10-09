"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { clearAttendance, confirmManyPayments, confirmPayment, deleteRegistration, markAttendanceById, rejectPayment, resendPasscodeEmail, updateRegistration } from "./actions";

type Row = {
  id: string; passcode: string | null; title: string | null; surname: string; firstName: string;
  otherNames: string | null; town: string | null;
  membershipNo: string | null; email: string; phone: string; firm: string | null;
  categoryId: string; mode: string; amount: string; amountKobo: number; txnRef: string | null;
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
  rows, categories, total, page, pageSize, query, isAdmin,
}: {
  rows: Row[];
  categories: { id: string; name: string }[];
  total: number; page: number; pageSize: number;
  query: { q?: string; status?: string; category?: string };
  /** Deleting a registration is an administrator's decision, not the desk's. */
  isAdmin: boolean;
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
  /* Two reasons to be picking rows, and they allow different things: anything
     can be exported, only an awaiting registration can be confirmed. One set
     of ticks serves both; the bar offers whatever the selection supports. */
  const [mode, setMode] = useState<null | "export" | "attendance">(null);
  const selecting = picked.size > 0 || mode !== null;
  const canTick = (r: Row) => mode !== null || r.status === "pending";
  const exportHref = (extra: Record<string, string> = {}) =>
    `/api/export/registrations?${new URLSearchParams({
      ...(Object.fromEntries(
        Object.entries(query).filter(([, v]) => v),
      ) as Record<string, string>),
      ...extra,
    }).toString()}`;
  const tickable = rows.filter(canTick);
  const allTicked = tickable.length > 0 && tickable.every((r) => picked.has(r.id));

  const startMode = (next: "export" | "attendance") => {
    setMode(next);
    setPicked(new Set());
  };

  const cancel = () => {
    setMode(null);
    setPicked(new Set());
  };

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
        <button
          type="button"
          aria-pressed={mode === "export"}
          className={`btn-secondary min-h-[44px] flex-1 sm:flex-none ${mode === "export" ? "border-green text-green" : ""}`}
          onClick={() => (mode === "export" ? cancel() : startMode("export"))}
        >
          Export to CSV
        </button>
        <button
          type="button"
          aria-pressed={mode === "attendance"}
          className={`btn-secondary min-h-[44px] flex-1 sm:flex-none ${mode === "attendance" ? "border-green text-green" : ""}`}
          onClick={() => (mode === "attendance" ? cancel() : startMode("attendance"))}
        >
          Export attendance list
        </button>

        {/* Hidden while exporting: in that mode the header checkbox selects
            everything on the page, and a second control scoped only to the
            awaiting rows would select a different set from the one its label
            implies. */}
        {!mode && selectable.length > 1 && (
          <button
            type="button"
            className="btn-secondary min-h-[44px] flex-1 sm:flex-none"
            onClick={() =>
              setPicked(allChosen ? new Set() : new Set(selectable.map((r) => r.id)))
            }
          >
            {allChosen ? "Clear selection" : `Select all ${selectable.length} awaiting`}
          </button>
        )}
      </div>

      {(selecting || selectable.length > 0 || rows.length > 0) && (
        <p className="help mt-3">
          {mode
            ? "Tick the rows you want, then use the button above the table. Leave everything unticked and cancel to start again."
            : selectable.length > 0
              ? `Tick the ${selectable.length} awaiting confirmation to confirm them together — each gets its participation code and an email. Press Export to choose rows for a spreadsheet instead.`
              : "Press Export to choose which registrations go into the spreadsheet."}
        </p>
      )}

      {selecting && (
        <div
          role="status"
          className="sticky top-2 z-20 mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-green bg-white p-4"
        >
          <p className="text-[15px] text-ink">
            {picked.size === 0
              ? mode === "attendance"
                ? "Tick the participants to include in the attendance list"
                : "Tick the registrations to export"
              : `${picked.size} ${picked.size === 1 ? "registration" : "registrations"} selected`}
            {chosen.length > 0 && (
              <span className="help mt-0.5 block">
                {chosen.length} of them {chosen.length === 1 ? "is" : "are"} awaiting
                confirmation. Confirming issues each participation code and emails
                it. There is no undo.
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary min-h-[44px] px-4" onClick={cancel}>
              Cancel
            </button>

            {picked.size > 0 && (
              <a
                className="btn-secondary min-h-[44px] px-4"
                href={exportHref({
                  ids: [...picked].join(","),
                  ...(mode === "attendance" ? { attended: "1" } : {}),
                })}
                onClick={() => setTimeout(cancel, 500)}
              >
                Export {picked.size} to CSV
              </a>
            )}

            {chosen.length > 0 && (
              <button
                type="button"
                disabled={bulkPending}
                className="btn-primary min-h-[44px] px-5 disabled:opacity-60"
                onClick={() => startBulk(async () => {
                  const ids = chosen.map((r) => r.id);
                  const res = await confirmManyPayments(ids);
                  cancel();
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
            )}
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
          <li key={r.id} className={`card p-4 ${picked.has(r.id) ? "border-green bg-green/5" : ""}`}>
            {/* Same rule as the table: the tick shows up once a selection is
                under way, and the label makes it unambiguous on a phone. */}
            {selecting && canTick(r) && (
              <label className="mb-3 flex items-center gap-3 text-[14px] text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={picked.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                Selected for confirmation
              </label>
            )}
            <button
              type="button"
              onClick={() => setOpen(r)}
              className="flex w-full items-start justify-between gap-3 text-left"
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
              {/* The whole column disappears when nothing on the page is
                  awaiting confirmation — on the Confirmed filter a greyed
                  checkbox that cannot do anything reads as broken rather than
                  as "nothing to select".

                  No visible word: the column was as wide as its heading, and
                  "Select" also implied it would tick every row, when it only
                  ever ticks the ones that can still be confirmed. The line
                  above the table carries that meaning instead. */}
              {(selecting || selectable.length > 0) && (
                <th scope="col" className="w-9 px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer align-middle"
                    aria-label={allTicked ? "Clear the selection" : `Select all ${tickable.length}`}
                    title={allTicked ? "Clear the selection" : `Select all ${tickable.length} on this page`}
                    checked={allTicked}
                    onChange={() =>
                      setPicked(allTicked ? new Set() : new Set(tickable.map((r) => r.id)))
                    }
                  />
                </th>
              )}
              {["Passcode", "Name", "Category", "Mode", "Amount", "Reference", "Status", "Registered"].map((h) => (
                <th key={h} scope="col" className="mono whitespace-nowrap px-4 py-3 text-[12px] uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={selecting || selectable.length > 0 ? 9 : 8} className="px-4 py-12 text-center text-[15px] text-muted">
                No registrations match these filters.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setOpen(r)}
                onKeyDown={(e) => { if (e.key === "Enter") setOpen(r); }}
                className={`cursor-pointer border-b border-line last:border-b-0 focus:bg-paper ${
                  picked.has(r.id) ? "bg-green/5" : "hover:bg-paper"
                }`}
              >
                {/* Row checkboxes appear only once a selection is under way.
                    Idle, the column is an empty gutter and the table stays
                    quiet; the moment the header box is ticked, every selected
                    row shows its tick — which is both the feedback that
                    something happened and the way to drop one person without
                    losing the rest. */}
                {(selecting || selectable.length > 0) && (
                  <td className="w-9 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {selecting && canTick(r) && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer align-middle"
                        aria-label={`${picked.has(r.id) ? "Deselect" : "Select"} ${r.firstName} ${r.surname}`}
                        checked={picked.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    )}
                  </td>
                )}

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

      {open && (
        <VerificationDrawer
          row={open}
          categories={categories}
          isAdmin={isAdmin}
          onClose={() => setOpen(null)}
          onChanged={() => { setOpen(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function VerificationDrawer({
  row, categories, isAdmin, onClose, onChanged,
}: {
  row: Row;
  categories: { id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
  /** Close and re-read, so the table shows the corrected or removed row. */
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditDrawer
        row={row}
        categories={categories}
        isAdmin={isAdmin}
        onCancel={() => setEditing(false)}
        onSaved={onChanged}
      />
    );
  }

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
          <div className="flex shrink-0 gap-2">
            {/* The usual answer to a wrong detail. It sits beside Close so an
                officer finds it while looking at the thing that is wrong. */}
            <button type="button" onClick={() => setEditing(true)} className="btn-secondary px-3">
              Edit
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-3">Close</button>
          </div>
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

              {/* The undo for a mis-tap, offered here because this is where an
                  officer sees the wrong name against "Attended". */}
              {row.scans > 0 && (
                <button
                  type="button" disabled={pending}
                  className="btn-secondary border-danger px-4 text-danger disabled:opacity-50"
                  onClick={() => start(async () => {
                    const res = await clearAttendance(row.id);
                    if (!("ok" in res)) { setError(res.error); setNote(null); return; }
                    setError(null);
                    setNote(`${res.name} is no longer marked present.`);
                  })}
                >
                  Not arrived
                </button>
              )}

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

/**
 * Correcting a registration, and — for an administrator — removing it.
 *
 * A separate view rather than fields that become editable in place: the
 * read-only drawer is what an officer uses at the desk while someone is
 * standing there, and turning every value into a text box makes that screen
 * harder to read for the sake of something done a handful of times an event.
 */
function EditDrawer({
  row, categories, isAdmin, onCancel, onSaved,
}: {
  row: Row;
  categories: { id: string; name: string }[];
  isAdmin: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  /* The delete panel keeps its own error. Sharing one with the form put
     "this record cannot be deleted" directly above Save changes, which reads
     as a failed save — the opposite of what happened. */
  const [delError, setDelError] = useState<string | null>(null);

  /* Attendance and certificates both cascade from this row, so a delete would
     take them with it — and a certificate already issued would stop resolving
     on the verify page. Refused here as well as in the action, so the button
     explains itself rather than failing after the click. */
  const blocked =
    row.scans > 0
      ? "This participant has been marked present. Their attendance record would go with them."
      : row.certificateSerial
      ? `Certificate ${row.certificateSerial} has been issued. Deleting would break its verification page.`
      : null;

  const field = (
    name: string,
    label: string,
    value: string,
    extra?: { type?: string; help?: string; mono?: boolean },
  ) => (
    <div>
      <label className="label" htmlFor={`e-${name}`}>{label}</label>
      <input
        id={`e-${name}`} name={name} defaultValue={value}
        type={extra?.type ?? "text"}
        className={extra?.mono ? "field-mono" : "field"}
      />
      {extra?.help && <p className="help">{extra.help}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-ink/40" onClick={onCancel} aria-hidden />
      <div
        role="dialog" aria-label="Edit registration"
        className="flex w-full flex-col overflow-y-auto border-line bg-white sm:max-w-[560px] sm:border-l"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 className="text-[20px] text-ink">Edit registration</h2>
            <p className="mono mt-1 text-[14px] text-muted">
              {row.passcode ?? "No code issued yet"}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="btn-secondary shrink-0 px-3">
            Cancel
          </button>
        </div>

        <form
          className="p-6"
          action={(fd) => start(async () => {
            fd.set("id", row.id);
            const res = await updateRegistration(fd);
            if (res?.error) { setError(res.error); return; }
            onSaved();
          })}
        >
          <h3 className="mono text-[12px] uppercase tracking-wider text-muted">Participant</h3>
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
              {field("title", "Title", row.title ?? "")}
              {field("surname", "Surname", row.surname)}
            </div>
            {field("firstName", "First name", row.firstName)}
            {field("otherNames", "Other names", row.otherNames ?? "")}
            {field("membershipNo", "Membership number", row.membershipNo ?? "", {
              mono: true,
              help: "One membership number may register once per event. Clearing it is allowed for categories that do not need one.",
            })}
            {field("email", "Email", row.email, {
              type: "email",
              help: "The passcode and certificate go here. Changing it does not resend anything — use “Resend their code” after saving.",
            })}
            {field("phone", "Phone", row.phone, { mono: true })}
            {field("firm", "Firm or organisation", row.firm ?? "")}
            {field("town", "Town", row.town ?? "")}
          </div>

          <h3 className="mono mt-8 text-[12px] uppercase tracking-wider text-muted">
            Category and payment
          </h3>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="e-categoryId">Category</label>
              <select id="e-categoryId" name="categoryId" className="field" defaultValue={row.categoryId}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="help">
                Changing the category does not change the amount below. Set both
                if the participant picked the wrong one.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="e-mode">Attendance mode</label>
              <select id="e-mode" name="mode" className="field" defaultValue={row.mode}>
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
            {field("amount", "Declared amount (₦)", (row.amountKobo / 100).toString(), {
              mono: true,
              help: "What they say they paid. Type it in naira, for example 10000.",
            })}
            {field("txnRef", "Bank reference / teller no.", row.txnRef ?? "", { mono: true })}
          </div>

          <p className="help mt-6">
            The proof of payment stays attached and the participation code, if
            one has been issued, stays the same.
          </p>

          {error && <p role="alert" className="mt-4 text-[14px] text-danger">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary flex-1 disabled:opacity-60">
              {pending ? "Saving" : "Save changes"}
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>

        {isAdmin && (
          <div className="mt-auto border-t border-line p-6">
            <h3 className="mono text-[12px] uppercase tracking-wider text-danger">
              Delete this registration
            </h3>
            <p className="mt-2 text-[14px] text-muted">
              Permanent. Use it for a duplicate or a test entry. If the
              participant simply made a mistake, correct it above instead —
              deleting makes them fill in the form again and re-upload their
              teller.
            </p>

            {blocked ? (
              <p className="mt-3 rounded border border-line bg-paper p-4 text-[14px] text-muted">
                {blocked}
              </p>
            ) : confirming ? (
              <>
                <label className="label mt-4" htmlFor="confirm-surname">
                  Type the surname <span className="text-ink">{row.surname}</span> to confirm
                </label>
                <input
                  id="confirm-surname" className="field" value={typed} autoComplete="off"
                  onChange={(e) => { setTyped(e.target.value); setDelError(null); }}
                />
                {delError && <p role="alert" className="mt-3 text-[14px] text-danger">{delError}</p>}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button" disabled={pending}
                    className="btn-secondary flex-1 border-danger text-danger disabled:opacity-50"
                    onClick={() => start(async () => {
                      const res = await deleteRegistration(row.id, typed);
                      if (res?.error) { setDelError(res.error); return; }
                      onSaved();
                    })}
                  >
                    {pending ? "Deleting" : "Delete permanently"}
                  </button>
                  <button
                    type="button" className="btn-secondary flex-1"
                    onClick={() => { setConfirming(false); setTyped(""); setDelError(null); }}
                  >
                    Keep it
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary mt-4 border-danger text-danger"
                onClick={() => { setConfirming(true); setDelError(null); }}
              >
                Delete registration
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}