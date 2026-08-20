/**
 * The site's signature element. One implementation, five consumers:
 * register/success, retrieve, photo-card, join, certificate.
 *
 * Previously this existed as five divergent copies — gold rule on one page,
 * grey on another, absent on three, notches nowhere. Do not fork it.
 */

type Row = { label: string; value: string };

export default function CredentialStrip({
  code,
  label = "Registration passcode",
  rows = [],
}: {
  code: string;
  label?: string;
  rows?: Row[];
}) {
  return (
    <div className="credential-strip px-6 pt-6 pb-8">
      <div className="gold-line" aria-hidden />

      <div className="text-center">
        <p className="mono text-[13px] uppercase tracking-[0.2em] text-muted">
          {label}
        </p>
        <p className="code mt-3 break-all" aria-label={`Passcode ${code.split("").join(" ")}`}>
          {code}
        </p>
      </div>

      {rows.length > 0 && (
        <dl className="mt-6 border-t border-line pt-1">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-4 border-b border-dashed border-line py-3 last:border-b-0"
            >
              <dt className="mono text-[13px] uppercase tracking-wider text-muted">
                {r.label}
              </dt>
              <dd className="mono text-[14px] text-ink text-right">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* The notches are what make this read as a detachable stub. */}
      <span className="notch left" aria-hidden />
      <span className="notch right" aria-hidden />
    </div>
  );
}
