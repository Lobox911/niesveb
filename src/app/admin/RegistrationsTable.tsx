"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmPayment, rejectPayment } from "./actions";

type Row = {
  id: string; passcode: string; title: string | null; surname: string; firstName: string;
  membershipNo: string | null; email: string; phone: string; firm: string | null;
  categoryId: string; mode: string; amount: string; txnRef: string;
  proofUrl: string | null; status: string; rejectionReason: string | null; createdAt: string;
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

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Registrations, newest first</caption>
          <thead>
            <tr className="border-b border-line">
              {["Passcode", "Name", "Category", "Mode", "Amount", "Reference", "Status", "Registered"].map((h) => (
                <th key={h} scope="col" className="mono whitespace-nowrap px-4 py-3 text-[12px] uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[15px] text-muted">
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
                <th scope="row" className="mono whitespace-nowrap px-4 py-3 text-[14px] font-normal text-ink">{r.passcode}</th>
                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-medium text-ink">
                  {[r.title, r.firstName, r.surname].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 text-[14px] text-muted">{r.categoryId}</td>
                <td className="px-4 py-3 text-[14px] capitalize text-muted">{r.mode}</td>
                <td className="mono whitespace-nowrap px-4 py-3 text-right text-[14px] text-ink">{r.amount}</td>
                <td className="mono px-4 py-3 text-[13px] text-muted">{r.txnRef}</td>
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

        <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
          <p className="mono text-[13px] text-muted">
            {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="btn-secondary px-3 disabled:opacity-40"
              onClick={() => setParam("page", String(page - 1))}>Previous</button>
            <button type="button" disabled={page >= pages} className="btn-secondary px-3 disabled:opacity-40"
              onClick={() => setParam("page", String(page + 1))}>Next</button>
          </div>
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-ink/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Registration details" className="w-full max-w-[560px] overflow-y-auto border-l border-line bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 className="text-[20px] text-ink">Registration details</h2>
            <p className="mono mt-1 text-[14px] text-muted">{row.passcode}</p>
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
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[13px] text-muted">Bank reference / teller no.</p>
              <p className="mono mt-1 select-all text-[15px] text-ink">{row.txnRef}</p>
            </div>
          </div>

          <h3 className="mono mt-8 text-[12px] uppercase tracking-wider text-muted">Proof of payment</h3>
          {row.proofUrl ? (
            <a href={row.proofUrl} target="_blank" rel="noreferrer" className="mt-3 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.proofUrl} alt="Proof of payment uploaded by the participant" className="w-full rounded border border-line" />
              <span className="mt-2 inline-block text-[14px] text-green underline underline-offset-4">Open full size</span>
            </a>
          ) : (
            <p className="mt-3 rounded border border-line bg-paper p-4 text-[14px] text-muted">
              No document uploaded. Verify against the bank statement using the reference above.
            </p>
          )}

          {row.status === "rejected" && row.rejectionReason && (
            <div className="mt-6 rounded border border-danger bg-white p-4">
              <p className="text-[13px] text-muted">Rejection reason sent to the participant</p>
              <p className="mt-1 text-[15px] text-ink">{row.rejectionReason}</p>
            </div>
          )}
        </div>

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
                onClick={() => start(async () => { await confirmPayment(row.id); onClose(); })}
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
