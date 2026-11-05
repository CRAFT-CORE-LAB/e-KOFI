# CRAFT HUB RWANDA — Company Profile

Premium A4 company profile (HTML source + exported PDF).

## Files

- `CRAFT-HUB-RWANDA-Company-Profile.pdf` — final deliverable for print and email
- `index.html` / `styles.css` — editable source
- `assets/` — brand logos

## Regenerate PDF

```bash
cd company-profile
npm install
npx playwright install chromium
node generate-pdf.mjs
```

Open `index.html` in a browser to preview layout before export.
