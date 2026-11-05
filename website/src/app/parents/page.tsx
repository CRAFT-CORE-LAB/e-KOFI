import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoBand } from '@/components/DemoBand';
import { FingerprintIcon } from '@/components/Icons';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'For parents',
  description: 'Meal money stays in a student wallet. Children pay at the school canteen with a fingerprint.',
};

const points = [
  {
    title: 'The money is for meals',
    text: 'You add Rwandan francs to your child’s wallet. That balance is there for the canteen.',
  },
  {
    title: 'Your child pays with a finger',
    text: 'The fingerprint stays with your child. That is how the canteen confirms who is paying.',
  },
  {
    title: 'The balance stays in the wallet',
    text: 'What is left after lunch remains on the wallet for the next meal. You can see that the money was used at school.',
  },
];

export default function ParentsPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="For parents"
        title="Meal money your child can use with a fingerprint."
        lede="Put lunch money in one wallet. At the canteen, your child places a finger, and the meal is paid from that balance."
      />
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <Link
          href="/parents/wallet"
          className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl bg-navy px-6 py-5 text-white hover:bg-[#16345c] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xl font-semibold">Top up my child&apos;s wallet</p>
            <p className="mt-1 text-base text-white/85">Use the Student ID only. No account to create.</p>
          </div>
          <span className="mt-3 inline-flex h-12 items-center rounded-full bg-teal px-6 text-base font-semibold text-navy sm:mt-0">
            Open parent wallet
          </span>
        </Link>
      </div>
      <section className="mx-auto grid max-w-6xl items-start gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          {points.map((point) => (
            <article key={point.title} className="rounded-[18px] border border-navy/10 bg-white p-6">
              <h2 className="text-xl font-semibold">{point.title}</h2>
              <p className="mt-2 leading-7 text-navy/75">{point.text}</p>
            </article>
          ))}
        </div>
        <aside className="rounded-[18px] border border-navy/10 bg-white p-6" aria-label="Example wallet">
          <p className="text-sm font-semibold text-pine">Example wallet</p>
          <p className="mt-4 text-sm text-muted">Student balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">12,400 RWF</p>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-cream px-4 py-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-pine">
              <FingerprintIcon />
            </span>
            <div>
              <p className="font-semibold">Lunch · Paid</p>
              <p className="text-sm text-muted">Today · 800 RWF</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            An example only. A real wallet shows your child’s balance and the meals paid by fingerprint.
          </p>
        </aside>
      </section>
      <DemoBand
        title="Ask your school about e-KOFI"
        text="Parents are welcome to request a demo. We will explain how the wallet and the fingerprint work together."
      />
    </div>
  );
}
