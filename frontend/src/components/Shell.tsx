'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/api';
import { AuthUser } from '@/lib/types';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/cards', label: 'NFC cards' },
  { href: '/canteens', label: 'Canteens' },
  { href: '/purchase', label: 'Purchase' },
  { href: '/transactions', label: 'Transactions' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = getStoredUser<AuthUser>();
    if (!stored) {
      router.replace('/login');
      return;
    }
    setUser(stored);
  }, [router]);

  if (!user) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-[#0B1F3A] text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="px-5 py-6">
          <img src="/ekofi-logo.jpg" alt="e-KOFI" className="h-10 w-auto rounded-md bg-white p-1" />
          <p className="mt-3 text-sm text-white/70">Safe money. Fast payments.</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                  active ? 'bg-[#14B8A6] text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 py-4 text-xs text-white/70 lg:block">
          <p>{user.name}</p>
          <p className="uppercase tracking-wide">{user.role}</p>
          <button
            className="mt-3 text-[#14B8A6] underline"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="px-4 py-6 lg:px-10">
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <p className="text-sm text-stone-600">
            {user.name} · {user.role}
          </p>
          <button
            className="text-sm underline"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
