"use client";
import EditableList from "./EditableList";
import { useState, useTransition } from "react";
import {
  saveCategory, deleteCategory, addStandardCategories,
  saveAdvertRate, deleteAdvertRate,
  saveProgrammeItem, deleteProgrammeItem,
} from "../actions";

type Cat = { id: string; key: string; name: string; eligibility: string; fee: number; units: number; requiresMembershipNo: boolean; sortOrder: number };
type Adv = { id: string; placement: string; spec: string; rate: number; sortOrder: number };
type Prog = { id: string; timeLabel: string; title: string; speaker: string; isBreak: boolean; sortOrder: number };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function CategoryList({ eventId, rows }: { eventId: string; rows: Cat[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <EditableList
      title="Participation categories"
      description="Who can attend and what each pays. These become the dropdown on the registration form and the fee table on the home page."
      addLabel="Add a category"
      rows={rows.map((c) => ({
        ...c,
        summary: c.name,
        detail: `${c.key} · ${naira(c.fee)} · ${c.units} units`,
      }))}
      fields={[
        { name: "name", label: "Category name", help: "As it appears on the fee table, for example: Fellows." },
        { name: "fee", label: "Fee in naira", type: "number", mono: true, width: "half", help: "Digits only, for example 10000." },
        { name: "units", label: "MCPD credit points", type: "number", mono: true, width: "half", help: "The flyer usually states this." },
        { name: "eligibility", label: "Who it is for", help: "Optional. One short line shown under the name." },
        { name: "requiresMembershipNo", label: "Ask for a NIESV membership number when someone picks this category", type: "checkbox" },
      ]}
      onSave={(fd) => { fd.set("eventId", eventId); return saveCategory(fd); }}
      onDelete={deleteCategory}
    >
      {rows.length === 0 && (
        <>
          <button
            type="button" disabled={pending} className="btn-secondary disabled:opacity-40"
            onClick={() => start(async () => {
              const res = await addStandardCategories(eventId);
              setError(res?.error ?? null);
            })}
          >
            {pending ? "Adding" : "Add the four standard NIESV categories"}
          </button>
          {error && <p role="alert" className="w-full text-[13px] text-danger">{error}</p>}
        </>
      )}
    </EditableList>
  );
}

export function AdvertList({ eventId, rows }: { eventId: string; rows: Adv[] }) {
  return (
    <EditableList
      title="Brochure advert rates"
      description="Optional. Advert placements in the event brochure, shown as a table on the home page. Leave empty if the branch is not selling adverts."
      addLabel="Add a placement"
      rows={rows.map((a) => ({ ...a, summary: a.placement, detail: naira(a.rate) }))}
      fields={[
        { name: "placement", label: "Placement", help: "For example: Full page (back cover)." },
        { name: "rate", label: "Rate in naira", type: "number", mono: true, help: "Digits only." },
        { name: "spec", label: "Specification", help: "Optional, for example: full colour, A4." },
      ]}
      onSave={(fd) => { fd.set("eventId", eventId); return saveAdvertRate(fd); }}
      onDelete={deleteAdvertRate}
    />
  );
}

export function ProgrammeList({ eventId, rows }: { eventId: string; rows: Prog[] }) {
  return (
    <EditableList
      title="Programme"
      description="The running order. Mark breaks so they render at lower prominence than sessions."
      addLabel="Add a session"
      rows={rows.map((p) => ({
        ...p,
        summary: p.title,
        detail: `${p.timeLabel}${p.speaker ? ` · ${p.speaker}` : ""}${p.isBreak ? " · break" : ""}`,
      }))}
      fields={[
        { name: "timeLabel", label: "Time", mono: true, width: "half", help: "For example: 09:30." },
        { name: "title", label: "Session title" },
        { name: "speaker", label: "Speaker", help: "Leave blank to show 'Speaker to be announced'." },
        { name: "isBreak", label: "This is a break, not a session", type: "checkbox" },
      ]}
      onSave={(fd) => { fd.set("eventId", eventId); return saveProgrammeItem(fd); }}
      onDelete={deleteProgrammeItem}
    />
  );
}