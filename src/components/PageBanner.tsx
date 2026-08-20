import Link from "next/link";

export default function PageBanner({
  title, crumb,
}: { title: string; crumb: string }) {
  return (
    <div className="bg-ink">
      <div className="container-content py-9 md:py-12">
        <p className="mono text-[13px] text-white/70">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="px-2">/</span>
          <span>{crumb}</span>
        </p>
        <h1 className="mt-2 text-[30px] md:text-[34px] text-white">{title}</h1>
      </div>
    </div>
  );
}
