import Link from 'next/link';

export function DemoBand({ title, text }: { title: string; text: string }) {
  return (
    <section className="px-6 pb-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[18px] bg-navy px-8 py-10 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-xl text-white/75">{text}</p>
        </div>
        <Link
          href="/demo"
          className="inline-flex h-12 shrink-0 items-center rounded-full bg-white px-6 text-sm font-semibold text-navy hover:bg-cream"
        >
          Request a demo
        </Link>
      </div>
    </section>
  );
}
