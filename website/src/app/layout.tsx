import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { social } from '@/lib/social';
import './globals.css';

const sans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-source',
});

export const metadata: Metadata = {
  title: {
    default: 'e-KOFI — Safe Money. Fast Payments. Made for Students.',
    template: '%s · e-KOFI',
  },
  description:
    'e-KOFI is cashless school-canteen payment for Rwanda. A student places a finger, the wallet pays in Rwandan francs, and the meal is done.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: social.displayName,
    title: 'e-KOFI — Safe Money. Fast Payments. Made for Students.',
    description:
      'Cashless school canteen payments in Rwanda. Students pay by fingerprint; wallets settle in Rwandan francs.',
    url: social.website,
  },
  twitter: {
    card: 'summary_large_image',
    site: `@${social.handle}`,
    title: 'e-KOFI — Safe Money. Fast Payments. Made for Students.',
    description:
      'Cashless school canteen payments in Rwanda. Students pay by fingerprint; wallets settle in Rwandan francs.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} bg-cream font-sans text-navy antialiased`}>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
