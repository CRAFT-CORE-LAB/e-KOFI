import Link from 'next/link';
import { ContactDetails } from '@/components/ContactDetails';
import { SocialLinks } from '@/components/SocialLinks';
import { nav } from '@/lib/nav';

export function Footer() {
  return (
    <footer className="border-t border-navy/10 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <img src="/logo.png" alt="e-KOFI" className="h-12 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Safe Money. Fast Payments. Made for Students.
          </p>
          <SocialLinks className="mt-6" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-navy">Visit</h2>
          <ul className="mt-3 space-y-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-muted hover:text-navy">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-navy">Talk to us</h2>
          <ContactDetails className="mt-3 text-sm leading-6" />
          <Link href="/demo" className="mt-4 inline-flex text-sm font-semibold text-pine hover:text-navy">
            Request a demo
          </Link>
        </div>
      </div>
      <div className="border-t border-navy/10">
        <p className="mx-auto max-w-6xl px-6 py-4 text-sm text-muted">
          © {new Date().getFullYear()} e-KOFI. Meal payments by fingerprint.
        </p>
      </div>
    </footer>
  );
}
