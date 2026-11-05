import type { Metadata } from 'next';
import { DemoBand } from '@/components/DemoBand';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'For schools',
  description: 'e-KOFI helps schools replace canteen cash with fingerprint payments and a record of every meal.',
};

const points = [
  {
    n: '01',
    title: 'Less cash on campus',
    text: 'Students arrive at the canteen ready to pay with a fingerprint. Meal money is already in the wallet, so the school handles less cash.',
  },
  {
    n: '02',
    title: 'A record of every meal',
    text: 'Each payment is posted and kept. Schools can see that a meal was paid, which student paid, and which canteen received it.',
  },
  {
    n: '03',
    title: 'Students identified by fingerprint',
    text: 'The reader matches the finger to the student who is standing there. The right wallet pays for the meal.',
  },
  {
    n: '04',
    title: 'Clear in plain language',
    text: 'Balances, meals, and canteen earnings are amounts in Rwandan francs. The story of a lunch is simple enough to explain to a parent.',
  },
];

export default function SchoolsPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="For schools"
        title="A canteen that does not run on cash."
        lede="e-KOFI gives every student a wallet and a fingerprint. Lunch is paid at the counter, and the school keeps a record of the meal."
      />
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2">
        {points.map((point) => (
          <article key={point.n} className="rounded-[18px] border border-navy/10 bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-teal">{point.n}</p>
            <h2 className="mt-2 text-2xl font-semibold">{point.title}</h2>
            <p className="mt-3 leading-7 text-navy/75">{point.text}</p>
          </article>
        ))}
      </section>
      <DemoBand
        title="Bring fingerprint payments to your canteen"
        text="Request a demo and we will show the path from enrollment to a meal marked Paid."
      />
    </div>
  );
}
