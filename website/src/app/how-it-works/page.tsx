import type { Metadata } from 'next';
import { DemoBand } from '@/components/DemoBand';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = {
  title: 'How fingerprint payment works',
  description: 'How a student pays for a school meal with a fingerprint and a wallet in Rwandan francs.',
};

const steps = [
  {
    n: '01',
    title: 'The school enrolls the student',
    text: 'Each student gets a wallet. The school saves a fingerprint and links it to that student. From then on, the finger is how the canteen recognizes who is paying.',
  },
  {
    n: '02',
    title: 'Meal money goes into the wallet',
    text: 'A parent or the school adds money in Rwandan francs. The balance is a whole number of francs, and it is what the student can spend at the canteen.',
  },
  {
    n: '03',
    title: 'The student pays with a finger',
    text: 'At lunch, the canteen enters the meal amount. The student places a finger on the reader. The wallet is debited, the canteen is credited, and the counter shows Paid.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="rise">
      <PageIntro
        eyebrow="How it works"
        title="From a fingerprint to a paid meal."
        lede="e-KOFI is built for the school canteen. The student pays by placing a finger on the reader. The wallet covers the meal."
      />
      <ol className="mx-auto grid max-w-3xl gap-4 px-6 pb-16">
        {steps.map((step) => (
          <li key={step.n} className="rounded-[18px] border border-navy/10 bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-teal">{step.n}</p>
            <h2 className="mt-2 text-2xl font-semibold">{step.title}</h2>
            <p className="mt-3 text-lg leading-8 text-navy/75">{step.text}</p>
          </li>
        ))}
      </ol>
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-[18px] border border-teal/30 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">What happens at the counter</h2>
          <p className="mt-3 leading-7 text-navy/75">
            The server types the price first. The fingerprint confirms which student pays. The canteen sees Paid, and the amount moves from the student wallet to the canteen.
          </p>
        </div>
      </section>
      <DemoBand
        title="Watch it with your own canteen in mind"
        text="Tell us about your school and we will walk through a fingerprint payment with you."
      />
    </div>
  );
}
