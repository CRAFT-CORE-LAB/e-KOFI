import Link from 'next/link';
import { CanteenScene } from '@/components/CanteenScene';
import { DemoBand } from '@/components/DemoBand';
import { BoltIcon, CapIcon, FingerprintIcon, ShieldIcon } from '@/components/Icons';

const promises = [
  {
    title: 'Safe & Secure',
    text: 'A fingerprint stays with the student. Meal money sits in a wallet, ready for the canteen.',
    icon: ShieldIcon,
  },
  {
    title: 'Fast & Easy',
    text: 'Amount, fingerprint, paid. The lunch line keeps moving.',
    icon: BoltIcon,
  },
  {
    title: 'Made for Students',
    text: 'Built for the school day, with balances kept in Rwandan francs.',
    icon: CapIcon,
  },
];

const steps = [
  {
    n: '01',
    title: 'Enroll a fingerprint',
    text: 'The school registers the student and saves a fingerprint, linked to that student’s wallet.',
  },
  {
    n: '02',
    title: 'Add meal money',
    text: 'A parent or the school adds Rwandan francs. That balance is what the student can spend.',
  },
  {
    n: '03',
    title: 'Pay at the counter',
    text: 'The canteen enters the meal amount. The student places a finger. The wallet pays, and the counter shows Paid.',
  },
];

const audiences = [
  {
    href: '/schools',
    kicker: 'For schools',
    title: 'Less cash on campus',
    text: 'Every meal is recorded, and each student is recognized by a fingerprint.',
  },
  {
    href: '/parents',
    kicker: 'For parents',
    title: 'Money that stays for meals',
    text: 'The wallet is for the canteen. A fingerprint is how your child pays.',
  },
  {
    href: '/canteens',
    kicker: 'For canteens',
    title: 'A faster lunch line',
    text: 'Enter the amount, take a fingerprint, and keep the earning with the canteen.',
  },
];

export default function HomePage() {
  return (
    <div className="rise">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-14 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="text-sm font-semibold text-pine">School canteens in Rwanda</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
            Pay for lunch with a <span className="text-pine">fingerprint</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-navy/75">
            e-KOFI replaces cash in the school canteen. A student places a finger, the wallet pays, and the meal is done.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-6 text-sm font-semibold text-white hover:bg-[#16345c]"
            >
              Request a demo
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-navy/15 bg-white px-6 text-sm font-semibold text-navy hover:border-navy/30"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Wallets in Rwandan francs. Payment is a fingerprint at the counter.</p>
        </div>
        <div>
          <div className="overflow-hidden rounded-[28px] border border-navy/10">
            <CanteenScene />
          </div>
          <p className="mt-3 text-center text-sm text-muted">A student pays at the canteen with a fingerprint.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-3" aria-label="Promises">
        {promises.map((item) => (
          <article key={item.title} className="rounded-[18px] border border-navy/10 bg-white p-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-pine">
              <item.icon />
            </span>
            <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 leading-7 text-navy/75">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3">
          <Proof title="Wallets in RWF" text="Balances are exact amounts in Rwandan francs." />
          <Proof title="One fingerprint per student" text="The finger on the reader is how the canteen knows who is paying." />
          <Proof title="Every meal recorded" text="Each payment stays on the record, tied to the student and the canteen." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-pine">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps to a paid meal</h2>
          </div>
          <Link href="/how-it-works" className="text-sm font-semibold text-pine hover:text-navy">
            Read the full steps
          </Link>
        </div>
        <ol className="mt-8 grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="rounded-[18px] border border-navy/10 bg-white p-6">
              <p className="text-sm font-semibold text-teal">{step.n}</p>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 leading-7 text-navy/75">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 lg:grid-cols-3">
        {audiences.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="lift block rounded-[18px] border border-navy/10 bg-white p-6 hover:border-pine/40"
          >
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-pine">
              <FingerprintIcon className="h-5 w-5" />
              {item.kicker}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{item.title}</h2>
            <p className="mt-2 leading-7 text-navy/75">{item.text}</p>
            <p className="mt-5 text-sm font-semibold text-navy">Learn more</p>
          </Link>
        ))}
      </section>

      <DemoBand
        title="Bring e-KOFI to your school"
        text="See a fingerprint payment at the canteen, from the first enrollment to a meal marked Paid."
      />
    </div>
  );
}

function Proof({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-teal">{title}</h2>
      <p className="mt-2 leading-7 text-white/75">{text}</p>
    </div>
  );
}
