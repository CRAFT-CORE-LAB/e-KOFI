import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoBand } from '@/components/DemoBand';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'For students',
  description: 'Check your e-KOFI wallet balance and see meals paid at the canteen.',
};

const points = [
  {
    title: 'See your balance',
    text: 'Know how much lunch money is left on your wallet before you go to the canteen.',
  },
  {
    title: 'Your school and class',
    text: 'When you sign in, you see your name, school, and class so you know it is the right wallet.',
  },
  {
    title: 'Meal history',
    text: 'Every meal paid with your fingerprint is listed with the date and amount.',
  },
];

export default function StudentsPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="For students"
        title="Your lunch wallet, on the web."
        lede="Create a password once with your Student ID, then sign in anytime to check balance and history. No app to install."
      />
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <Link
          href="/students/wallet"
          className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl bg-navy px-6 py-5 text-white hover:bg-[#16345c] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xl font-semibold">Open my wallet</p>
            <p className="mt-1 text-base text-white/85">Student ID + password. Works in your phone browser.</p>
          </div>
          <span className="mt-3 inline-flex h-12 items-center rounded-full bg-teal px-6 text-base font-semibold text-navy sm:mt-0">
            Student sign in
          </span>
        </Link>
      </div>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 md:grid-cols-3">
        {points.map((point) => (
          <article key={point.title} className="rounded-[18px] border border-navy/10 bg-white p-6">
            <h2 className="text-xl font-semibold">{point.title}</h2>
            <p className="mt-2 leading-7 text-navy/75">{point.text}</p>
          </article>
        ))}
      </section>
      <DemoBand
        title="First time?"
        text="Ask your teacher for your Student ID, then choose a password on the wallet page. Parents add money from the parent wallet."
      />
    </div>
  );
}
