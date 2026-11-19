# CRAFT HUB RWANDA — Company Profile

Premium A4 company profile (HTML source + exported PDF).

## Files

- `CRAFT-HUB-RWANDA-Company-Profile.pdf` — final deliverable for print and email
- `index.html` / `styles.css` — editable source
- `assets/` — brand logos
- `assets/ekofi-pullup-banner-print.jpg` — pull-up artwork with background design, socials, and contact (no room / stand)
- `assets/ekofi-pullup-banner-design-only.jpg` — earlier export without exhibition mockup
- `ekofi-pullup-banner-print.html` — open in browser and print at **85 cm × 200 cm**, 100% scale, no margins

## Print e-KOFI pull-up banner

1. Open `ekofi-pullup-banner-print.html` in Chrome or Edge.
2. **Print** → paper size custom **85 cm × 200 cm** (or send `ekofi-pullup-banner-print.jpg` directly to your print shop).
3. Use **100%** scale and **no margins** so only the banner face prints.

## Regenerate PDF

```bash
cd company-profile
npm install
npx playwright install chromium
node generate-pdf.mjs
```

Open `index.html` in a browser to preview layout before export.
