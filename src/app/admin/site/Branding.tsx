"use client";
import { useState, useTransition } from "react";
import { updateBranding } from "../actions";
import FileUpload from "@/components/FileUpload";

/** Relative luminance check, mirrored from lib/site so the warning can run
 *  as you type rather than only after saving. */
function contrastWithWhite(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

export default function Branding({
  metaTitle, metaDescription, faviconUrl, ogImageUrl, primaryColor, accentColor,
  canonicalUrl, searchIndexable, googleVerification, analyticsId,
}: {
  metaTitle: string; metaDescription: string;
  faviconUrl: string | null; ogImageUrl: string | null;
  primaryColor: string; accentColor: string;
  canonicalUrl: string; searchIndexable: boolean;
  googleVerification: string; analyticsId: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [primary, setPrimary] = useState(primaryColor);
  const [accent, setAccent] = useState(accentColor);

  const primaryRatio = contrastWithWhite(primary);
  const accentRatio = contrastWithWhite(accent);

  const Swatch = ({
    id, label, value, onChange, ratio, help,
  }: {
    id: string; label: string; value: string;
    onChange: (v: string) => void; ratio: number; help: string;
  }) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" aria-label={`${label} picker`} value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded border border-line bg-white p-1" />
        <input id={id} name={id} className="field-mono max-w-[140px]" value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span className="rounded px-3 py-2 text-[14px] font-semibold text-white" style={{ background: value }}>
          Button
        </span>
      </div>
      <p className="help">{help}</p>
      {ratio > 0 && ratio < 4.5 && (
        <p className="mt-1.5 text-[13px] text-danger">
          White text on this colour has a contrast ratio of {ratio.toFixed(1)}:1,
          below the 4.5:1 minimum. Choose a darker shade or button labels will be
          hard to read.
        </p>
      )}
    </div>
  );

  return (
    <section className="mt-12 max-w-[640px]">
      <h2 className="text-[20px] text-ink">Branding and search</h2>
      <p className="mt-1 text-[15px] text-muted">
        How the site appears in search results, when shared on WhatsApp, and in
        the browser tab.
      </p>

      <form
        className="mt-5"
        action={(fd) => start(async () => {
          const res = await updateBranding(fd);
          setMsg(res);
          if (res?.ok) setTimeout(() => setMsg(null), 4000);
        })}
      >
        <fieldset className="card p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Search and sharing</legend>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="canonicalUrl">Website address</label>
              <input id="canonicalUrl" name="canonicalUrl" className="field-mono"
                defaultValue={canonicalUrl} placeholder="https://www.niesvebonyi.com.ng" />
              <p className="help">
                The one address the site should be known by. More than one
                address reaches this site, and without this setting search
                engines treat them as separate sites competing with each other.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="metaTitle">Page title</label>
              <input id="metaTitle" name="metaTitle" className="field" defaultValue={metaTitle} />
              <p className="help">
                Shown in the browser tab and as the headline in search results.
                Around 60 characters. Blank uses the featured event.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="metaDescription">Description</label>
              <textarea id="metaDescription" name="metaDescription" rows={3} className="field py-2"
                defaultValue={metaDescription} />
              <p className="help">
                The paragraph under the title in search results. Around 155
                characters. Blank uses the event theme and venue.
              </p>
            </div>
            <div>
              {faviconUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={faviconUrl} alt="Current favicon" className="mb-2 h-8 w-8 rounded border border-line" />
              )}
              <FileUpload
                name="faviconUrl"
                folder="favicon"
                maxMb={1}
                currentUrl={faviconUrl}
                label="Favicon"
                accept="image/png,image/x-icon,image/svg+xml"
                help="PNG, ICO or SVG, up to 1MB. Square, at least 64 by 64. The crest works well."
              />
            </div>

            <div>
              <label className="flex items-start gap-3 text-[15px] text-ink">
                <input type="checkbox" name="searchIndexable" defaultChecked={searchIndexable} className="mt-1" />
                <span>
                  Allow this site to appear in search results
                  <span className="help mt-0.5 block">
                    Turn this off while the site is being prepared. Google drops
                    the pages within days and takes weeks to put them back, so
                    leave it on once the seminar has been announced.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="label" htmlFor="analyticsId">Google Analytics measurement ID</label>
              <input id="analyticsId" name="analyticsId" className="field-mono"
                defaultValue={analyticsId} placeholder="G-XXXXXXXXXX" />
              <p className="help">
                From the data stream in Google Analytics. Leave blank to collect
                nothing. Visitor numbers only, no personal details.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="googleVerification">Search Console verification code</label>
              <input id="googleVerification" name="googleVerification" className="field-mono"
                defaultValue={googleVerification} />
              <p className="help">
                When Search Console offers the HTML tag method, paste only the
                content value, not the whole tag.
              </p>
            </div>

            <div>
              {ogImageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={ogImageUrl} alt="Current share image" className="mb-2 h-24 w-full rounded border border-line object-cover" />
              )}
              <FileUpload
                name="ogImageUrl"
                folder="og"
                maxMb={4}
                currentUrl={ogImageUrl}
                label="Share image"
                accept="image/jpeg,image/png,image/webp"
                help="The picture shown when the link is shared on WhatsApp or Facebook. 1200 by 630 works best — the flyer is a good choice."
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="card mt-5 p-6">
          <legend className="mono px-2 text-[12px] uppercase tracking-wider text-muted">Colours</legend>
          <div className="space-y-5">
            <Swatch id="primaryColor" label="Primary" value={primary} onChange={setPrimary}
              ratio={primaryRatio}
              help="Buttons, links and active states." />
            <Swatch id="accentColor" label="Accent" value={accent} onChange={setAccent}
              ratio={accentRatio}
              help="Deadlines, the passcode strip rule and other highlights." />
          </div>
          <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
            Only these two are editable. Text, backgrounds, borders and the error
            colour stay fixed, because they carry the contrast guarantees for
            body copy across every page.
          </p>
        </fieldset>

        <div className="mt-6">
          {msg?.error && <p role="alert" className="mb-3 text-[14px] text-danger">{msg.error}</p>}
          {msg?.ok && <p role="status" className="mb-3 text-[14px] text-green">Saved.</p>}
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
            {pending ? "Saving" : "Save branding"}
          </button>
        </div>
      </form>
    </section>
  );
}