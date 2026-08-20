import PageBanner from "@/components/PageBanner";

export default async function VerifyPage({
  params,
}: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  // TODO: look the serial up. Unknown serials render the "No record" state.
  const found = true;

  return (
    <>
      <PageBanner title="Certificate verification" crumb="Verify" />
      <div className="container-content py-14">
        <div className="card mx-auto max-w-[560px] p-6">
          <p className="mono text-[12px] uppercase tracking-wider text-muted">Serial</p>
          <p className="mono mt-1 select-all text-[20px] text-ink">{serial}</p>
          <p
            className={`mono mt-5 inline-flex rounded border px-3 py-1.5 text-[12px] uppercase tracking-wider ${
              found ? "border-green/40 bg-green/10 text-green" : "border-line bg-paper text-muted"
            }`}
          >
            {found ? "Verified" : "No record"}
          </p>
        </div>
      </div>
    </>
  );
}
