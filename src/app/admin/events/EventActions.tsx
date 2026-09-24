"use client";
import { useState, useTransition } from "react";
import { featureEvent, deleteEvent } from "../actions";

export default function EventActions({ id, isFeatured }: { id: string; isFeatured: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {!isFeatured && (
        <button type="button" disabled={pending} className="btn-secondary px-3 disabled:opacity-40"
          onClick={() => start(async () => { const r = await featureEvent(id); if (r?.error) setError(r.error); })}>
          Feature
        </button>
      )}
      <button type="button" disabled={pending}
        className="btn-secondary border-danger px-3 text-danger disabled:opacity-40"
        onClick={() => start(async () => { const r = await deleteEvent(id); if (r?.error) setError(r.error); })}>
        Delete
      </button>
      {error && <p role="alert" className="w-full text-[13px] text-danger">{error}</p>}
    </>
  );
}