"use client";
import EditableList from "./EditableList";
import {
  saveCategory, deleteCategory,
  saveAdvertRate, deleteAdvertRate,
  saveProgrammeItem, deleteProgrammeItem,
} from "../actions";

type Cat = { id: string; key: string; name: string; eligibility: string; fee: number; units: number; requiresMembershipNo: boolean; sortOrder: number };
type Adv = { id: string; placement: string; spec: string; rate: number; sortOrder: number };
type Prog = { id: string; timeLabel: string; title: string; speaker: string; isBreak: boolean; sortOrder: number };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function CategoryList({ eventId, rows }: { eventId: string; rows: Cat[] }) {
  return (
    <EditableList
      title="Participation categories"
      description="Add, rename or remove categories, and set each fee and MCPD unit count. A category with registrations against it cannot be deleted."
      addLabel="Add a category"
      rows={rows.map((c) => ({
        ...c,
        summary: c.name,
        detail: `${c.key} · ${naira(c.fee)} · ${c.units} units`,
      }))}
      fields={[
        { name: "key", label: "Key", mono: true, width: "half", help: "Lowercase, hyphens. Used in registration links." },
        { name: "sortOrder", label: "Order", type: "number", mono: true, width: "half" },
        { name: "name", label: "Name" },
        { name: "eligibility", label: "Who it is for" },
        { name: "fee", label: "Fee in naira", type: "number", mono: true, width: "half" },
        { name: "units", label: "MCPD units", type: "number", mono: true, width: "half" },
        { name: "requiresMembershipNo", label: "Requires a NIESV membership number", type: "checkbox" },
      ]}
      onSave={(fd) => { fd.set("eventId", eventId); return saveCategory(fd); }}
      onDelete={deleteCategory}
    />
  );
}

export function AdvertList({ eventId, rows }: { eventId: string; rows: Adv[] }) {
  return (
    <EditableList
      title="Brochure advert rates"
      description="Placements shown in the advert table on the home page."
      addLabel="Add a placement"
      rows={rows.map((a) => ({ ...a, summary: a.placement, detail: naira(a.rate) }))}
      fields={[
        { name: "placement", label: "Placement" },
        { name: "spec", label: "Specification", help: "Optional, for example: full page, colour." },
        { name: "rate", label: "Rate in naira", type: "number", mono: true, width: "half" },
        { name: "sortOrder", label: "Order", type: "number", mono: true, width: "half" },
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
        { name: "sortOrder", label: "Order", type: "number", mono: true, width: "half" },
        { name: "title", label: "Session title" },
        { name: "speaker", label: "Speaker", help: "Leave blank to show 'Speaker to be announced'." },
        { name: "isBreak", label: "This is a break, not a session", type: "checkbox" },
      ]}
      onSave={(fd) => { fd.set("eventId", eventId); return saveProgrammeItem(fd); }}
      onDelete={deleteProgrammeItem}
    />
  );
}