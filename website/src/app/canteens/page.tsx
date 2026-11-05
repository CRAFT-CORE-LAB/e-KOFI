import type { Metadata } from 'next';
import { DemoBand } from '@/components/DemoBand';
import { FingerprintIcon } from '@/components/Icons';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'For canteens',
  description: 'Serve lunch faster. Enter the amount, take a fingerprint, and keep the earning with the canteen.',
};

const points = [
  {
    title: 'The counter stays fast',
    text: 'At the lunch rush, each student is a short stop: the price, a finger on the reader, and Paid.',
  },
  {
    title: 'The earning stays with the canteen',
    text: 'When a meal is paid, the amount leaves the student wallet and is credited to the canteen.',
  },
  {
    title: 'Less cash to count',
    text: 'The canteen takes a fingerprint payment. Staff spend the service on meals, and the record shows what was earned.',
  },
];

export default function CanteensPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="For canteens"
        title="Amount, fingerprint, paid."
        lede="The lunch line should keep moving. e-KOFI lets the canteen take a fingerprint payment and keep a clear record of the earning."
      />
      <section className="mx-auto grid max-w-6xl items-start gap-6 px-6 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[18px] bg-navy p-6 text-white sm:p-8">
          <p className="text-sm font-semibold text-teal">At the counter</p>
          <ol className="mt-6 space-y-5">
            <li>
              <p className="text-sm text-white/60">1 · Meal amount</p>
              <p className="mt-1 text-3xl font-semibold">800 RWF</p>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-pine">
                <FingerprintIcon className="h-8 w-8" />
              </span>
              <div>
                <p className="text-sm text-white/60">2 · Student</p>
                <p className="text-xl font-semibold">Fingerprint</p>
              </div>
            </li>
            <li>
              <p className="text-sm text-white/60">3 · Result</p>
              <p className="mt-1 text-3xl font-semibold text-teal">Paid</p>
            </li>
          </ol>
          <p className="mt-6 text-sm leading-6 text-white/70">An example meal. The reader confirms the student, then the wallet pays the canteen.</p>
        </div>
        <div className="grid gap-4">
          {points.map((point) => (
            <article key={point.title} className="rounded-[18px] border border-navy/10 bg-white p-6">
              <h2 className="text-xl font-semibold">{point.title}</h2>
              <p className="mt-2 leading-7 text-navy/75">{point.text}</p>
            </article>
          ))}
        </div>
      </section>
      <DemoBand
        title="See a lunch service with e-KOFI"
        text="We will walk through the counter: price, fingerprint, and a payment credited to the canteen."
      />
    </div>
  );
}
