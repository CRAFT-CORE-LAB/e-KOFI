import type { Metadata } from 'next';
import { ContactDetails } from '@/components/ContactDetails';
import { DemoForm } from '@/components/DemoForm';

export const metadata: Metadata = {
  title: 'Request a demo',
  description: 'Ask e-KOFI to show fingerprint payments for your school canteen.',
};

export default function DemoPage() {
  return (
    <div className="rise">
      <section className="mx-auto grid max-w-6xl items-start gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="text-sm font-semibold text-pine">Request a demo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">See a fingerprint payment.</h1>
          <p className="mt-4 text-lg leading-8 text-navy/75">
            Tell us who you are and which school you have in mind. We will show how a student pays for lunch with a finger, and how the wallet and the canteen stay in step.
          </p>
          <ul className="mt-8 space-y-3 text-navy/80">
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" />
              Enrollment and the student’s fingerprint
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" />
              A wallet balance in Rwandan francs
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" />
              A canteen counter that ends on Paid
            </li>
          </ul>
          <ContactDetails className="mt-8 text-sm leading-6" />
        </div>
        <DemoForm />
      </section>
    </div>
  );
}
