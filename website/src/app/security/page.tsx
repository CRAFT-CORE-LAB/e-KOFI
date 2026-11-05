import type { Metadata } from 'next';
import { DemoBand } from '@/components/DemoBand';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Fingerprint payments for the school canteen, with every meal kept on the record in Rwandan francs.',
};

const points = [
  {
    title: 'The fingerprint stays with the student',
    text: 'The reader uses the student’s own finger to confirm who is paying. That is the payment at the counter.',
  },
  {
    title: 'Each payment is recorded',
    text: 'A meal is written down with the student, the canteen, and the amount in Rwandan francs.',
  },
  {
    title: 'Posted meals stay as they were',
    text: 'A completed payment remains on the record. The history of lunch is something the school can trust.',
  },
  {
    title: 'Balances are exact francs',
    text: 'Wallet amounts are whole Rwandan francs, so a meal and the balance after it add up cleanly.',
  },
];

export default function SecurityPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="Security"
        title="A payment the student carries with them."
        lede="e-KOFI confirms the student with a fingerprint, then moves the meal amount from the wallet to the canteen."
      />
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-10 sm:grid-cols-2">
        {points.map((point) => (
          <article key={point.title} className="rounded-[18px] border border-navy/10 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{point.title}</h2>
            <p className="mt-3 leading-7 text-navy/75">{point.text}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[18px] bg-navy px-6 py-8 text-white sm:px-8">
          <h2 className="text-2xl font-semibold">Payment is a fingerprint</h2>
          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Students pay by placing a finger on the canteen reader. The fingerprint is the payment.
          </p>
        </div>
      </section>
      <DemoBand
        title="Questions about how a meal is protected?"
        text="Request a demo and we will walk through enrollment, the wallet, and a fingerprint payment."
      />
    </div>
  );
}
