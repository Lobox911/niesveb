"use client";
import { useRef, useState, useTransition } from "react";
import FileUpload from "@/components/FileUpload";
import { updateCertificateSettings } from "../actions";

type Parts = Record<string, boolean>;
type Line = {
  text: string;
  place: "underHeading" | "underName" | "underStatement" | "aboveSignatures" | "footer";
  size: "small" | "normal" | "large";
  style: "plain" | "italic" | "bold";
};

/** Every switchable part, in the order it appears down the page. */
const PARTS: { key: string; label: string; help: string }[] = [
  { key: "border", label: "Decorative border", help: "The double rule around the edge. Turn it off when you upload artwork that has its own." },
  { key: "crest", label: "Branch crest", help: "Printed at the top. Uses the crest from Site settings." },
  { key: "branchName", label: "Branch name", help: "In small capitals under the crest." },
  { key: "heading", label: "“Certificate of Participation”", help: "The main heading and the gold rule under it." },
  { key: "certifyLine", label: "“This is to certify that”", help: "The italic line above the participant’s name." },
  { key: "statement", label: "The statement", help: "The sentence naming the event, date and venue." },
  { key: "theme", label: "Event theme", help: "The seminar theme in quotation marks." },
  { key: "units", label: "MCPD credit units", help: "The units line in the accent colour." },
  { key: "signatures", label: "Signature block", help: "Names, roles and signature images." },
  { key: "qr", label: "QR code", help: "Scanning it opens the verification page. Removing it makes the certificate harder to check." },
  { key: "serial", label: "Serial number", help: "Still issued and recorded even when it is not printed." },
  { key: "verifyLine", label: "“Verify at …” line", help: "The web address under the QR code." },
];

const PLACES: { value: Line["place"]; label: string }[] = [
  { value: "underHeading", label: "Under the heading" },
  { value: "underName", label: "Under the name" },
  { value: "underStatement", label: "Under the statement" },
  { value: "aboveSignatures", label: "Above the signatures" },
  { value: "footer", label: "At the foot" },
];

export default function CertificateSettings({
  chairmanName, chairmanTitle, chairmanSignatureUrl,
  secretaryName, secretaryTitle, secretarySignatureUrl,
  certificateBackgroundUrl, certificateSerialPrefix, certificateStatement,
  certificateParts, certificateExtraLines,
}: {
  chairmanName: string; chairmanTitle: string; chairmanSignatureUrl: string | null;
  secretaryName: string; secretaryTitle: string; secretarySignatureUrl: string | null;
  certificateBackgroundUrl: string | null;
  certificateSerialPrefix: string;
  certificateStatement: string;
  certificateParts: string;
  certificateExtraLines: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [parts, setParts] = useState<Parts>(() => {
    const off = (() => {
      try { return JSON.parse(certificateParts || "{}") as Parts; } catch { return {}; }
    })();
    return Object.fromEntries(PARTS.map((p) => [p.key, off[p.key] !== false]));
  });

  const [lines, setLines] = useState<Line[]>(() => {
    try {
      const v = JSON.parse(certificateExtraLines || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });

  // null = keep what is saved, "" = remove it, a URL = replace it.
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  const [preview, setPreview] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  /**
   * Draws the certificate from what is on screen, saved or not.
   *
   * Reading the live form rather than component state so the statement, names
   * and prefix are whatever has just been typed — the whole point is to look
   * before committing.
   */
  const redraw = async () => {
    setDrawing(true);
    try {
      const fd = new FormData(formRef.current ?? undefined);
      const text = (k: string) => String(fd.get(k) ?? "");

      const res = await fetch("/api/certificate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: Object.fromEntries(PARTS.map((p) => [p.key, parts[p.key]])),
          extraLines: lines,
          statement: text("certificateStatement"),
          chairmanName: text("chairmanName"),
          chairmanTitle: text("chairmanTitle"),
          secretaryName: text("secretaryName"),
          secretaryTitle: text("secretaryTitle"),
          serialPrefix: text("certificateSerialPrefix"),
          ...(removed.certificateBackgroundUrl ? { backgroundUrl: null } : {}),
          ...(removed.chairmanSignatureUrl ? { chairmanSignatureUrl: null } : {}),
          ...(removed.secretarySignatureUrl ? { secretarySignatureUrl: null } : {}),
        }),
      });
      if (!res.ok) return;

      const blob = await res.blob();
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } finally {
      setDrawing(false);
    }
  };

  const Switch = ({ p }: { p: (typeof PARTS)[number] }) => (
    <label className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
      <input
        type="checkbox"
        name={`part.${p.key}`}
        className="mt-1 h-4 w-4"
        checked={parts[p.key]}
        onChange={(e) => setParts((v) => ({ ...v, [p.key]: e.target.checked }))}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{p.label}</span>
        <span className="help mt-0.5 block">{p.help}</span>
      </span>
    </label>
  );

  const Removable = ({
    field, url, label, help, accept, folder, maxMb,
  }: {
    field: string; url: string | null; label: string; help: string;
    accept: string; folder: string; maxMb: number;
  }) => {
    const gone = removed[field];
    return (
      <div>
        {url && !gone && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Current ${label.toLowerCase()}`}
              className="mb-2 max-h-28 w-auto rounded border border-line bg-white p-1" />
            <button
              type="button"
              className="btn-secondary border-danger px-3 py-1.5 text-[13px] text-danger"
              onClick={() => setRemoved((v) => ({ ...v, [field]: true }))}
            >
              Remove this
            </button>
          </div>
        )}

        {gone && (
          <p className="mb-3 flex flex-wrap items-center gap-3 text-[14px] text-danger">
            Will be removed when you save.
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-[13px]"
              onClick={() => setRemoved((v) => ({ ...v, [field]: false }))}
            >
              Keep it
            </button>
          </p>
        )}

        {/* Tells the server to clear the column rather than ignore the field. */}
        {gone && <input type="hidden" name={`${field}__remove`} value="1" />}

        <FileUpload
          name={field}
          folder={folder}
          maxMb={maxMb}
          currentUrl={gone ? null : url}
          label={label}
          accept={accept}
          help={help}
        />
      </div>
    );
  };

  return (
    <section className="mt-12 max-w-[1100px]">
      <h2 className="text-[20px] text-ink">Certificate</h2>
      <p className="mt-1 max-w-prose text-[15px] text-muted">
        Applies to every certificate issued from now on. Certificates already
        downloaded keep the serial they were issued with.
      </p>

      <form
        ref={formRef}
        className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        action={(fd) => start(async () => {
          const res = await updateCertificateSettings(fd);
          setMsg(res);
          if (res?.ok) {
            setRemoved({});
            setTimeout(() => setMsg(null), 4000);
          }
        })}
      >
        <div>
          <input type="hidden" name="partsSubmitted" value="1" />
          <input type="hidden" name="extraLinesJson" value={JSON.stringify(lines)} />

          <fieldset className="card p-6">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Signatories</legend>
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="chairmanName">Chairman&rsquo;s name</label>
                  <input id="chairmanName" name="chairmanName" className="field"
                    defaultValue={chairmanName} placeholder="Esv. Ikechukwu Nwafor" />
                  <p className="help">Exactly as it should be printed, including the title.</p>
                </div>
                <div>
                  <label className="label" htmlFor="chairmanTitle">Role as printed</label>
                  <input id="chairmanTitle" name="chairmanTitle" className="field"
                    defaultValue={chairmanTitle} placeholder="Chairman" />
                </div>
                <Removable
                  field="chairmanSignatureUrl"
                  url={chairmanSignatureUrl}
                  label="Chairman&rsquo;s signature"
                  folder="signatures"
                  maxMb={2}
                  accept="image/png,image/jpeg,image/webp"
                  help="A PNG with a transparent background works best. Sign on white paper, photograph it, and remove the background."
                />
              </div>

              <div className="space-y-4 border-t border-line pt-6">
                <div>
                  <label className="label" htmlFor="secretaryName">Secretary&rsquo;s name</label>
                  <input id="secretaryName" name="secretaryName" className="field"
                    defaultValue={secretaryName} placeholder="Esv. Ngozi Alieze" />
                </div>
                <div>
                  <label className="label" htmlFor="secretaryTitle">Role as printed</label>
                  <input id="secretaryTitle" name="secretaryTitle" className="field"
                    defaultValue={secretaryTitle} placeholder="Secretary" />
                </div>
                <Removable
                  field="secretarySignatureUrl"
                  url={secretarySignatureUrl}
                  label="Secretary&rsquo;s signature"
                  folder="signatures"
                  maxMb={2}
                  accept="image/png,image/jpeg,image/webp"
                  help="Same again. Leave blank to print the name over a ruled line."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="card mt-6 p-6">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">What is printed</legend>
            <p className="help mb-2">
              Untick anything you do not want on the certificate. Serial numbers
              are still issued and recorded even when the serial is not printed.
            </p>
            <div>
              {PARTS.map((p) => <Switch key={p.key} p={p} />)}
            </div>
          </fieldset>

          <fieldset className="card mt-6 p-6">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Your own lines</legend>
            <p className="help mb-4">
              For anything the standard layout does not cover — an accreditation
              number, a co-host, a motto. Up to five.
            </p>

            {lines.length === 0 && (
              <p className="rounded border border-line bg-paper p-4 text-[14px] text-muted">
                No extra lines. The certificate prints the standard layout.
              </p>
            )}

            <div className="space-y-4">
              {lines.map((l, i) => (
                <div key={i} className="card p-4">
                  <label className="label" htmlFor={`line-${i}`}>Line {i + 1}</label>
                  <input
                    id={`line-${i}`}
                    className="field"
                    value={l.text}
                    maxLength={160}
                    onChange={(e) =>
                      setLines((v) => v.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)))
                    }
                  />

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label" htmlFor={`place-${i}`}>Position</label>
                      <select id={`place-${i}`} className="field" value={l.place}
                        onChange={(e) =>
                          setLines((v) => v.map((x, n) => (n === i ? { ...x, place: e.target.value as Line["place"] } : x)))
                        }>
                        {PLACES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`size-${i}`}>Size</label>
                      <select id={`size-${i}`} className="field" value={l.size}
                        onChange={(e) =>
                          setLines((v) => v.map((x, n) => (n === i ? { ...x, size: e.target.value as Line["size"] } : x)))
                        }>
                        <option value="small">Small</option>
                        <option value="normal">Normal</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`style-${i}`}>Style</label>
                      <select id={`style-${i}`} className="field" value={l.style}
                        onChange={(e) =>
                          setLines((v) => v.map((x, n) => (n === i ? { ...x, style: e.target.value as Line["style"] } : x)))
                        }>
                        <option value="plain">Plain</option>
                        <option value="italic">Italic</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary mt-4 border-danger px-3 py-1.5 text-[13px] text-danger"
                    onClick={() => setLines((v) => v.filter((_, n) => n !== i))}
                  >
                    Remove this line
                  </button>
                </div>
              ))}
            </div>

            {lines.length < 5 && (
              <button
                type="button"
                className="btn-secondary mt-4 min-h-[44px]"
                onClick={() =>
                  setLines((v) => [...v, { text: "", place: "underStatement", size: "normal", style: "plain" }])
                }
              >
                Add a line
              </button>
            )}
          </fieldset>

          <fieldset className="card mt-6 p-6">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Wording and numbering</legend>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="certificateStatement">Certificate statement</label>
                <textarea id="certificateStatement" name="certificateStatement" rows={3} className="field py-2"
                  defaultValue={certificateStatement}
                  placeholder="participated in the {event} held on {date} at {venue}, and is hereby awarded {units} MCPD credit units." />
                <p className="help">
                  Follows the participant&rsquo;s name. Use{" "}
                  <span className="mono">{"{event}"}</span>,{" "}
                  <span className="mono">{"{theme}"}</span>,{" "}
                  <span className="mono">{"{date}"}</span>,{" "}
                  <span className="mono">{"{venue}"}</span>,{" "}
                  <span className="mono">{"{units}"}</span> and{" "}
                  <span className="mono">{"{category}"}</span> where those values
                  should appear. Blank uses the standard wording.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="certificateSerialPrefix">Serial prefix</label>
                <input id="certificateSerialPrefix" name="certificateSerialPrefix" className="field-mono"
                  defaultValue={certificateSerialPrefix} placeholder="NIESV-EB" />
                <p className="help">
                  Serials run as prefix, year and number &mdash; NIESV-EB/2026/0001.
                  Letters, numbers and hyphens only. Changing it does not renumber
                  certificates already issued.
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset className="card mt-6 p-6">
            <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Artwork</legend>
            <Removable
              field="certificateBackgroundUrl"
              url={certificateBackgroundUrl}
              label="Certificate artwork"
              folder="certificate"
              maxMb={8}
              accept="image/png,image/jpeg"
              help="Optional. A full-bleed A4 landscape design from your printer, 3508 by 2480 or larger. With artwork uploaded, only the text parts above are printed on top — leave the middle of the page clear."
            />
            <p className="help mt-3">
              With no artwork the certificate is drawn from the crest and branch
              colours, which is a complete certificate on its own.
            </p>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending}
              className="btn-primary min-h-[46px] px-6 disabled:opacity-60">
              {pending ? "Saving" : "Save certificate settings"}
            </button>
            {msg?.ok && <span className="text-[15px] text-green">Saved.</span>}
            {msg?.error && <span role="alert" className="text-[15px] text-danger">{msg.error}</span>}
          </div>
        </div>

        {/* Preview. Sticky on a laptop so it stays beside the controls. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] text-ink">Preview</h3>
              <button
                type="button"
                disabled={drawing}
                className="btn-secondary min-h-[40px] px-4 text-[14px] disabled:opacity-60"
                onClick={() => void redraw()}
              >
                {drawing ? "Drawing" : preview ? "Redraw" : "Show preview"}
              </button>
            </div>

            <p className="help mt-2">
              A sample certificate with dummy details, drawn from what is on
              screen &mdash; including changes you have not saved.
            </p>

            {preview ? (
              <>
                <object
                  data={preview}
                  type="application/pdf"
                  className="mt-4 h-[280px] w-full rounded border border-line"
                  aria-label="Certificate preview"
                >
                  <p className="p-4 text-[14px] text-muted">
                    Your browser will not show the PDF here.{" "}
                    <a href={preview} target="_blank" rel="noreferrer" className="text-green underline">
                      Open it in a new tab
                    </a>.
                  </p>
                </object>
                <a href={preview} target="_blank" rel="noreferrer"
                  className="mt-3 inline-block text-[14px] text-green underline underline-offset-4">
                  Open full size
                </a>
              </>
            ) : (
              <div className="mt-4 grid h-[280px] place-items-center rounded border border-dashed border-line bg-paper">
                <p className="max-w-[28ch] text-center text-[14px] text-muted">
                  Press Show preview to see how the certificate will print.
                </p>
              </div>
            )}
          </div>
        </aside>
      </form>
    </section>
  );
}