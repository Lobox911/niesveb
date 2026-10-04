"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveEvent } from "../../actions";

type Ev = {
  id: string; slug: string; title: string; theme: string; eventType: string | null;
  startsAt: Date; endsAt: Date | null; registrationDeadline: Date | null;
  timeLine: string | null; venue: string; venueAddress: string;
  meetingUrl: string | null; meetingId: string | null; status: string;
  aboutHeading: string | null; aboutBody: string | null;
  takeawaysHeading: string | null; takeaways: string | null;
};

const iso = (d: Date | null | undefined) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export default function EventForm({ event }: { event?: Ev }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <form
      className="mt-8"
      action={(fd) => start(async () => {
        const res = await saveEvent(fd);
        setMsg(res);
        if (res?.ok && !event) router.push(`/admin/events/${res.id}`);
      })}
    >
      {event && <input type="hidden" name="id" value={event.id} />}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <fieldset className="card p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">The seminar</legend>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Event title</label>
              <input id="title" name="title" className="field" required defaultValue={event?.title ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="slug">Slug</label>
              <input id="slug" name="slug" className="field-mono" required
                defaultValue={event?.slug ?? ""} placeholder="mcpd-2026" />
              <p className="help">Lowercase and hyphens. Used in links to this event.</p>
            </div>
            <div>
              <label className="label" htmlFor="theme">Theme</label>
              <input id="theme" name="theme" className="field" defaultValue={event?.theme ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="eventType">Event type</label>
              <input id="eventType" name="eventType" className="field"
                defaultValue={event?.eventType ?? "Hybrid event"} />
              <p className="help">Shown above the hero title.</p>
            </div>
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" className="field" defaultValue={event?.status ?? "draft"}>
                <option value="draft">Draft — not on the public site</option>
                <option value="open">Open — accepting registrations</option>
                <option value="closed">Closed — registration shut, certificates open</option>
                <option value="archived">Archived — past event</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="card p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">When and where</legend>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="startsAt">Starts at</label>
              <input id="startsAt" name="startsAt" type="datetime-local" className="field"
                required defaultValue={iso(event?.startsAt)} />
            </div>
            <div>
              <label className="label" htmlFor="endsAt">Ends at</label>
              <input id="endsAt" name="endsAt" type="datetime-local" className="field"
                defaultValue={iso(event?.endsAt)} />
              <p className="help">For a two-day seminar. Leave blank for a single day.</p>
            </div>
            <div>
              <label className="label" htmlFor="timeLine">Time, as written</label>
              <input id="timeLine" name="timeLine" className="field"
                defaultValue={event?.timeLine ?? ""} placeholder="09:00 WAT daily" />
            </div>
            <div>
              <label className="label" htmlFor="registrationDeadline">Registration deadline</label>
              <input id="registrationDeadline" name="registrationDeadline" type="datetime-local"
                className="field" defaultValue={iso(event?.registrationDeadline)} />
            </div>
            <div>
              <label className="label" htmlFor="venue">Venue</label>
              <input id="venue" name="venue" className="field" defaultValue={event?.venue ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="venueAddress">Venue address</label>
              <input id="venueAddress" name="venueAddress" className="field"
                defaultValue={event?.venueAddress ?? ""} />
            </div>
          </div>
        </fieldset>

        <fieldset className="card p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Virtual session</legend>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="meetingUrl">Meeting link</label>
              <input id="meetingUrl" name="meetingUrl" type="url" className="field"
                defaultValue={event?.meetingUrl ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="meetingId">Meeting ID</label>
              <input id="meetingId" name="meetingId" className="field" defaultValue={event?.meetingId ?? ""} />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Full width rather than a third column: this is prose, and a narrow
          textarea makes two paragraphs look like twelve. */}
      <fieldset className="card mt-5 p-6">
        <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">
          About the seminar
        </legend>
        <p className="help mb-4">
          The block under the hero on the home page. Leave anything blank to use
          the standard wording.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="aboutHeading">Heading</label>
            <input id="aboutHeading" name="aboutHeading" className="field"
              defaultValue={event?.aboutHeading ?? ""} placeholder="About the seminar" />
          </div>
          <div>
            <label className="label" htmlFor="aboutBody">Body text</label>
            <textarea id="aboutBody" name="aboutBody" rows={7} className="field"
              defaultValue={event?.aboutBody ?? ""} />
            <p className="help">
              Leave a blank line between paragraphs. Each one becomes its own
              paragraph on the page.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="takeawaysHeading">Second heading</label>
            <input id="takeawaysHeading" name="takeawaysHeading" className="field"
              defaultValue={event?.takeawaysHeading ?? ""} placeholder="What you leave with" />
          </div>
          <div>
            <label className="label" htmlFor="takeaways">What they leave with</label>
            <textarea id="takeaways" name="takeaways" rows={4} className="field"
              defaultValue={event?.takeaways ?? ""}
              placeholder={"MCPD credit units\nE-certificate of participation\nSeminar brochure"} />
            <p className="help">
              One per line, up to eight. They print across the page separated by
              slashes, so keep each to a few words.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="sticky bottom-0 mt-6 border-t border-line bg-paper py-4">
        {msg?.error && <p role="alert" className="mb-3 text-[14px] text-danger">{msg.error}</p>}
        {msg?.ok && <p role="status" className="mb-3 text-[14px] text-green">Saved.</p>}
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Saving" : event ? "Save event" : "Create event"}
        </button>
      </div>
    </form>
  );
}