import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-content py-24 text-center">
      <h1 className="text-[34px]">Page not found</h1>
      <p className="mt-3 text-[17px] text-muted">
        That page does not exist, or it has moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Home</Link>
        <Link href="/register" className="btn-secondary">Register</Link>
        <Link href="/retrieve" className="btn-secondary">Retrieve passcode</Link>
      </div>
    </div>
  );
}
