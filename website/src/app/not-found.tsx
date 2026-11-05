import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rise mx-auto max-w-3xl px-6 py-24">
      <p className="text-sm font-semibold text-pine">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">This page is not on the e-KOFI site.</h1>
      <p className="mt-4 text-lg text-navy/75">The page you asked for is not here. You can return home or request a demo.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-6 text-sm font-semibold text-white">
          Back home
        </Link>
        <Link href="/demo" className="inline-flex h-12 items-center justify-center rounded-full border border-navy/15 bg-white px-6 text-sm font-semibold text-navy">
          Request a demo
        </Link>
      </div>
    </div>
  );
}
