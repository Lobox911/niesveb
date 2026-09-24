"use client";
import { useState, useTransition } from "react";
import { updateEventSettings } from "../actions";

type Initial = Record<string, string>;

const GROUPS: { legend: string; fields: [string, string, string?, string?][] }[] = [
  {
    legend: "The branch",
    fields: [
      ["branchName", "Branch name", "text", "Appears in the footer and page titles."],
      ["registeredAddress", "Registered address", "text", "Shown in the footer."],
    ],
  },
  {
    legend: "The seminar",
    fields: [
      ["eventTitle", "Event title"],
      ["theme", "Theme", "text", "Appears as the headline on the home page."],
      ["startsAt", "Starts at", "datetime-local"],
      ["timeLine", "Time, as written", "text", "For example: 09:00 WAT daily."],
      ["registrationDeadline", "Registration deadline", "datetime-local"],
      ["venue", "Venue"],
      ["venueAddress", "Venue address", "text", "Used for search listings and the map."],
    ],
  },
  {
    legend: "Bank details",
    fields: [
      ["bankName", "Bank name"],
      ["accountName", "Account name"],
      ["accountNumber", "Account number", "text", "Check this digit by digit. Participants copy it straight into their banking app."],
    ],
  },
  {
    legend: "Virtual session",
    fields: [
      ["meetingUrl", "Meeting link", "url"],
      ["meetingId", "Meeting ID"],
    ],
  },
  {
    legend: "Contact",
    fields: [
      ["supportWhatsapp", "Support WhatsApp number"],
      ["contactEmail", "Contact email", "email"],
      ["contactPhones", "Contact phone numbers", "text", "Separate several with commas. They appear in the footer as tappable links."],
    ],
  },
];

export default function EventSettingsForm({ initial }: { initial: Initial }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <form
      className="mt-8 max-w-[640px]"
      action={(fd) => start(async () => {
        const res = await updateEventSettings(fd);
        setMsg(res);
        if (res?.ok) setTimeout(() => setMsg(null), 4000);
      })}
    >
      {GROUPS.map((g) => (
        <fieldset key={g.legend} className="card mt-5 p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">{g.legend}</legend>
          <div className="space-y-4">
            {g.fields.map(([name, label, type = "text", help]) => (
              <div key={name}>
                <label className="label" htmlFor={name}>{label}</label>
                <input
                  id={name} name={name} type={type}
                  defaultValue={initial[name] ?? ""}
                  className={name === "accountNumber" ? "field-mono" : "field"}
                />
                {help && <p className="help">{help}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="card mt-5 p-6">
        <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">About the seminar</legend>
        <label className="label" htmlFor="aboutBody">Body text</label>
        <textarea
          id="aboutBody" name="aboutBody" rows={8} className="field py-2"
          defaultValue={initial.aboutBody ?? ""}
        />
        <p className="help">
          Leave a blank line between paragraphs. Blank falls back to the default copy.
        </p>
      </fieldset>

      <div className="sticky bottom-0 mt-6 border-t border-line bg-paper py-4">
        {msg?.error && <p role="alert" className="mb-3 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mb-3 text-[14px] text-green">Saved. The public site is updated.</p>}
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Saving" : "Save event settings"}
        </button>
      </div>
    </form>
  );
}