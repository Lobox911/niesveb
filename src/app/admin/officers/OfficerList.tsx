"use client";
import { useState, useTransition } from "react";
import { createOfficer, setOfficerActive, setOfficerRole, changePassword } from "../actions";

type Row = {
  id: string; name: string; email: string;
  role: "officer" | "admin"; active: boolean; createdAt: string;
};

export default function OfficerList({ rows, currentId }: { rows: Row[]; currentId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string } | void>) =>
    start(async () => { setMsg((await fn()) ?? null); });

  return (
    <div className="mt-8 max-w-[760px]">
      {msg?.error && <p role="alert" className="mb-4 text-[14px] text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="mb-4 text-[14px] text-green">Saved.</p>}

      <ul>
        {rows.map((r) => (
          <li key={r.id} className="card mb-3 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold text-ink">
                  {r.name}
                  {r.id === currentId && (
                    <span className="mono ml-3 text-[12px] uppercase tracking-wider text-muted">you</span>
                  )}
                </p>
                <p className="mono text-[13px] text-muted">{r.email}</p>
              </div>

              <span className={`mono rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${
                r.active ? "border-green/40 bg-green/10 text-green" : "border-line bg-paper text-muted"
              }`}>
                {r.active ? r.role : "inactive"}
              </span>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary px-3"
                  onClick={() => { setResetting(resetting === r.id ? null : r.id); setMsg(null); }}>
                  Reset password
                </button>

                {r.id !== currentId && (
                  <>
                    <button type="button" disabled={pending} className="btn-secondary px-3 disabled:opacity-40"
                      onClick={() => run(() => setOfficerRole(r.id, r.role === "admin" ? "officer" : "admin"))}>
                      Make {r.role === "admin" ? "officer" : "admin"}
                    </button>
                    <button type="button" disabled={pending}
                      className={`btn-secondary px-3 disabled:opacity-40 ${r.active ? "border-danger text-danger" : ""}`}
                      onClick={() => run(() => setOfficerActive(r.id, !r.active))}>
                      {r.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {resetting === r.id && (
              <form className="mt-5 border-t border-line pt-5"
                action={(fd) => { fd.set("officerId", r.id); run(async () => { const res = await changePassword(fd); if (res?.ok) setResetting(null); return res; }); }}>
                <label className="label" htmlFor={`pw-${r.id}`}>New password</label>
                <input id={`pw-${r.id}`} name="password" type="password" className="field max-w-[320px]" />
                <p className="help">At least 10 characters. Tell the person directly — it is not emailed.</p>
                <div className="mt-3 flex gap-3">
                  <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Set password</button>
                  <button type="button" className="btn-secondary" onClick={() => setResetting(null)}>Cancel</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="card mt-5 p-6"
          action={(fd) => run(async () => { const res = await createOfficer(fd); if (res?.ok) setAdding(false); return res; })}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="field" />
              <p className="help">At least 10 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="role">Role</label>
              <select id="role" name="role" className="field" defaultValue="officer">
                <option value="officer">Officer — payments and attendance</option>
                <option value="admin">Administrator — everything</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? "Adding" : "Add user"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setAdding(false); setMsg(null); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-primary mt-4" onClick={() => { setAdding(true); setMsg(null); }}>
          Add a user
        </button>
      )}
    </div>
  );
}