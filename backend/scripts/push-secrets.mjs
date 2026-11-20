import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Production secrets live on the Cloudflare Worker. This does not read Railway.
const envPath = new URL('../.env', import.meta.url);
const envText = fs.readFileSync(envPath, 'utf8');
const keys = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'OPENAI_API_KEY',
  'INTOUCH_CALLBACK_URL',
];
const payload = {};
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match || !keys.includes(match[1])) continue;
  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (value) payload[match[1]] = value;
}
if (Object.keys(payload).length === 0) {
  console.error('No Cloudflare secrets to upload from backend/.env');
  process.exit(1);
}
const file = path.join(os.tmpdir(), `ekofi-secrets-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify(payload));
try {
  execSync(`npx wrangler secret bulk ${file}`, { stdio: 'inherit' });
} finally {
  fs.unlinkSync(file);
}
console.log(`uploaded ${Object.keys(payload).length} Cloudflare secrets`);
