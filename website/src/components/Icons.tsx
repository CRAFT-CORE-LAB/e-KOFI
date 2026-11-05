export function FingerprintIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M24 40V27" />
        <path d="M16.5 36.5C13 33.2 11 29 11 24a13 13 0 0 1 26 0c0 2.8-.5 5.2-1.4 7.4" />
        <path d="M19 33.5c-2.2-2.2-3.4-5-3.4-8.5a8.4 8.4 0 0 1 16.8 0c0 2-.3 3.8-.9 5.4" />
        <path d="M21.2 30c-1.1-1.4-1.7-3.2-1.7-5.2a4.5 4.5 0 0 1 9 0c0 1.1-.2 2.1-.5 3" />
        <path d="M13 22.5a11.2 11.2 0 0 1 21.2-5" />
      </g>
    </svg>
  );
}

export function ShieldIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M24 6 38 11.2v11.2C38 32 32.2 38 24 42 15.8 38 10 32 10 22.4V11.2L24 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="m18 24 4.2 4.2L30 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BoltIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M26 6 12 27h10l-2 15 16-23H26l0-13Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

export function CapIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="m6 20 18-8 18 8-18 8L6 20Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 24v8c3 4 17 4 20 0v-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M42 20v10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
