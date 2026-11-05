'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { nav } from '@/lib/nav';

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="sticky top-0 z-40">
      <div className="h-1 bg-teal" />
      <header className="border-b border-navy/10 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="shrink-0 rounded-md">
            <img src="/logo.png" alt="e-KOFI" className="h-11 w-auto" />
          </Link>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`text-[15px] font-semibold ${active ? 'text-pine' : 'text-navy/75 hover:text-navy'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="hidden h-12 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white hover:bg-[#16345c] lg:inline-flex"
            >
              Request a demo
            </Link>
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-navy/10 bg-white lg:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              {open ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {open ? (
          <nav id="site-menu" className="border-t border-navy/10 px-6 py-4 lg:hidden" aria-label="Primary">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-12 items-center rounded-xl px-3 text-base font-semibold ${active ? 'bg-white text-pine' : 'text-navy'}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/demo"
              className="mt-3 flex h-12 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white"
            >
              Request a demo
            </Link>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
