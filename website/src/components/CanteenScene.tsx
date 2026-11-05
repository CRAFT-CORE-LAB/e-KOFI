function FingerMark({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="#0F766E" strokeWidth="2.4" strokeLinecap="round">
      <path d="M18 36V24" />
      <path d="M11 32c-2.6-2.4-4-5.6-4-9a11 11 0 0 1 22 0c0 2.2-.4 4.2-1.2 6" />
      <path d="M13.5 29.5c-1.6-1.8-2.5-4-2.5-6.5a7 7 0 0 1 14 0c0 1.6-.2 3-.7 4.3" />
      <path d="M15.6 26.5c-.8-1.1-1.2-2.4-1.2-4a3.6 3.6 0 0 1 7.2 0c0 .9-.1 1.7-.4 2.4" />
      <path d="M8.5 21.5a9.6 9.6 0 0 1 18-4.2" />
    </g>
  );
}

export function CanteenScene() {
  return (
    <svg viewBox="0 0 720 540" role="img" className="h-auto w-full font-sans" aria-label="A student pays for a meal by placing a finger on the canteen reader. The counter shows Paid.">
      <rect width="720" height="540" fill="#E5F6F3" />

      <g>
        {[150, 360, 560].map((x) => (
          <g key={x}>
            <line x1={x} y1="0" x2={x} y2="58" stroke="#0B1F3A" strokeWidth="3" />
            <circle cx={x} cy="74" r="18" fill="#0B1F3A" />
            <circle cx={x} cy="74" r="7" fill="#14B8A6" />
          </g>
        ))}
      </g>

      <g>
        <rect x="36" y="118" width="150" height="104" rx="16" fill="#0B1F3A" />
        <rect x="36" y="118" width="150" height="28" rx="12" fill="#14B8A6" />
        <rect x="52" y="162" width="96" height="8" rx="4" fill="#FFFFFF" />
        <rect x="52" y="180" width="72" height="8" rx="4" fill="#FFFFFF" opacity="0.55" />
        <rect x="52" y="198" width="84" height="8" rx="4" fill="#FFFFFF" opacity="0.55" />
      </g>

      <circle cx="650" cy="132" r="34" fill="#FFFFFF" />
      <FingerMark x={632} y={114} scale={0.9} />

      <g>
        <rect x="118" y="356" width="16" height="96" rx="8" fill="#0B1F3A" />
        <rect x="146" y="356" width="16" height="96" rx="8" fill="#0B1F3A" />
        <ellipse cx="126" cy="456" rx="16" ry="8" fill="#FFFFFF" />
        <ellipse cx="154" cy="456" rx="16" ry="8" fill="#FFFFFF" />
        <path d="M104 312h72l16 58H88l16-58Z" fill="#14B8A6" />
        <rect x="112" y="258" width="58" height="68" rx="18" fill="#FFFFFF" />
        <path d="M108 268c-16-6-28-28-16-46" stroke="#C9844A" strokeWidth="14" strokeLinecap="round" />
        <circle cx="86" cy="214" r="9" fill="#C9844A" />
        <circle cx="140" cy="214" r="30" fill="#C9844A" />
        <path d="M114 210c2-28 14-42 26-42s24 14 26 40c-8-12-18-16-26-16s-18 4-26 18Z" fill="#241910" />
        <circle cx="112" cy="198" r="12" fill="#241910" />
        <circle cx="168" cy="198" r="12" fill="#241910" />
        <ellipse cx="140" cy="222" rx="24" ry="22" fill="#C9844A" />
        <circle cx="130" cy="216" r="2.2" fill="#0B1F3A" />
        <circle cx="150" cy="216" r="2.2" fill="#0B1F3A" />
        <path d="M128 228c4 6 18 6 22 0" stroke="#0B1F3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      <g>
        <rect x="262" y="348" width="18" height="108" rx="8" fill="#0B1F3A" />
        <rect x="292" y="348" width="18" height="108" rx="8" fill="#0B1F3A" />
        <ellipse cx="271" cy="460" rx="16" ry="8" fill="#FFFFFF" />
        <ellipse cx="301" cy="460" rx="16" ry="8" fill="#FFFFFF" />
        <rect x="246" y="268" width="80" height="96" rx="22" fill="#14B8A6" />
        <circle cx="286" cy="214" r="32" fill="#B56A3C" />
        <path d="M258 214c2-30 14-46 28-46s26 16 28 44c-8-14-18-18-28-18s-20 5-28 20Z" fill="#0B1F3A" />
        <ellipse cx="286" cy="224" rx="26" ry="22" fill="#B56A3C" />
        <circle cx="276" cy="216" r="2.2" fill="#0B1F3A" />
        <circle cx="296" cy="216" r="2.2" fill="#0B1F3A" />
        <path d="M274 230c4 6 18 6 22 0" stroke="#0B1F3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      <g>
        <rect x="560" y="248" width="78" height="70" rx="20" fill="#123056" />
        <circle cx="598" cy="214" r="28" fill="#C9844A" />
        <path d="M574 208c4-24 14-36 24-36s20 12 24 34c-6-10-14-14-24-14s-18 4-24 16Z" fill="#241910" />
        <ellipse cx="598" cy="220" rx="22" ry="20" fill="#C9844A" />
        <path d="M574 196c8-8 40-8 50 2 2 14-8 20-14 16-8-10-22-12-28-4-6 6-12 4-8-14Z" fill="#14B8A6" />
        <circle cx="588" cy="216" r="2" fill="#0B1F3A" />
        <circle cx="606" cy="216" r="2" fill="#0B1F3A" />
      </g>

      <g>
        <rect x="430" y="168" width="250" height="14" rx="7" fill="#0B1F3A" />
        <rect x="470" y="132" width="28" height="36" rx="8" fill="#FFFFFF" />
        <rect x="470" y="132" width="28" height="10" rx="6" fill="#14B8A6" />
        <rect x="520" y="146" width="22" height="22" rx="11" fill="#FFFFFF" />
        <rect x="556" y="140" width="18" height="28" rx="8" fill="#14B8A6" />
      </g>

      <rect x="392" y="292" width="292" height="168" rx="22" fill="#0B1F3A" />
      <rect x="372" y="276" width="322" height="32" rx="12" fill="#16355C" />

      <g transform="translate(500 332)">
        <path d="M40 4 70 16v22c0 16-12 26-30 34C22 64 10 54 10 38V16L40 4Z" fill="#FFFFFF" />
        <text x="36" y="50" fill="#0B1F3A" fontSize="30" fontWeight="700" fontFamily="inherit">
          K
        </text>
        <path d="M58 22c4 3 6 6 6 10" stroke="#14B8A6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M64 17c6 4 9 9 9 15" stroke="#14B8A6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>

      <rect x="430" y="214" width="92" height="78" rx="16" fill="#FFFFFF" />
      <FingerMark x={452} y={228} scale={0.85} />
      <path d="M318 292c28-8 70-18 112-16" stroke="#B56A3C" strokeWidth="16" strokeLinecap="round" />
      <circle cx="438" cy="270" r="13" fill="#B56A3C" />

      <g>
        <rect x="520" y="168" width="118" height="46" rx="23" fill="#FFFFFF" />
        <circle cx="546" cy="191" r="12" fill="#14B8A6" />
        <path d="m540 191 4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="566" y="197" fill="#0B1F3A" fontSize="18" fontWeight="700" fontFamily="inherit">
          Paid
        </text>
      </g>
    </svg>
  );
}
