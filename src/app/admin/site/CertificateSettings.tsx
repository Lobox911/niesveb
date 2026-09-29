"use client";
import { useState, useTransition } from "react";
import FileUpload from "@/components/FileUpload";
import { updateCertificateSettings } from "../actions";

/**
 * Who signs the certificate and what it says.
 *
 * Every field here is optional. A certificate with no signatures still prints
 * with ruled lines and the names, and with no names at all it prints without
 * that block entirely — which is what lets the branch go live before the
 * chairman has sent a scan of his signature.
 */
export default function CertificateSettings({
  chairmanName, chairmanTitle, chairmanSignatureUrl,
  secretaryName, secretaryTitle, secretarySignatureUrl,
  certificateBackgroundUrl, certificateSerialPrefix, certificateStatement,
}: {
  chairmanName: string; chairmanTitle: string; chairmanSignatureUrl: string | null;
  secretaryName: string; secretaryTitle: string; secretarySignatureUrl: string | null;
  certificateBackgroundUrl: string | null;
  certificateSerialPrefix: string;
  certificateStatement: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Certificate</h2>
      <p className="mt-1 text-[15px] text-muted">
        Applies to every certificate issued from now on. Certificates already
        downloaded keep the serial they were issued with.
      </p>

      <form
        className="mt-5"
        action={(fd) => start(async () => {
          const res = await updateCertificateSettings(fd);
          setMsg(res);
          if (res?.ok) setTimeout(() => setMsg(null), 4000);
        })}
      >
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
              <div>
                {chairmanSignatureUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={chairmanSignatureUrl} alt="Current chairman signature"
                    className="mb-2 h-16 w-auto rounded border border-line bg-white p-1" />
                )}
                <FileUpload
                  name="chairmanSignatureUrl"
                  folder="signatures"
                  maxMb={2}
                  currentUrl={chairmanSignatureUrl}
                  label="Chairman&rsquo;s signature"
                  accept="image/png,image/jpeg,image/webp"
                  help="A PNG with a transparent background works best. Sign on white paper, photograph it, and remove the background."
                />
              </div>
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
              <div>
                {secretarySignatureUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={secretarySignatureUrl} alt="Current secretary signature"
                    className="mb-2 h-16 w-auto rounded border border-line bg-white p-1" />
                )}
                <FileUpload
                  name="secretarySignatureUrl"
                  folder="signatures"
                  maxMb={2}
                  currentUrl={secretarySignatureUrl}
                  label="Secretary&rsquo;s signature"
                  accept="image/png,image/jpeg,image/webp"
                  help="Same again. Leave blank to print the name over a ruled line."
                />
              </div>
            </div>
          </div>
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
                Serials run as prefix, year and number — NIESV-EB/2026/0001.
                Letters, numbers and hyphens only. Changing it does not
                renumber certificates already issued.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="card mt-6 p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Artwork</legend>
          <div>
            {certificateBackgroundUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={certificateBackgroundUrl} alt="Current certificate artwork"
                className="mb-2 w-full rounded border border-line" />
            )}
            <FileUpload
              name="certificateBackgroundUrl"
              folder="certificate"
              maxMb={8}
              currentUrl={certificateBackgroundUrl}
              label="Certificate artwork"
              accept="image/png,image/jpeg"
              help="Optional. A full-bleed A4 landscape design from your printer, 3508 by 2480 or larger. With artwork uploaded, only the name, wording, signatures and serial are printed on top — leave the middle of the page clear."
            />
            <p className="help mt-3">
              Leave this empty and the certificate is drawn from the crest and
              branch colours, which is a complete certificate on its own.
            </p>
          </div>
        </fieldset>

        <div className="mt-6 flex items-center gap-4">
          <button type="submit" disabled={pending}
            className="btn-primary min-h-[46px] px-6 disabled:opacity-60">
            {pending ? "Saving" : "Save certificate settings"}
          </button>
          {msg?.ok && <span className="text-[15px] text-green">Saved.</span>}
          {msg?.error && <span role="alert" className="text-[15px] text-danger">{msg.error}</span>}
        </div>
      </form>
    </section>
  );
}