import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const raw = execSync(
  'railway variables -s api -p eca4e5ed-9614-4f85-b612-bc6ade9ee8df -e production --json',
  { encoding: 'utf8' },
);
const vars = JSON.parse(raw);
const keys = [
  'JWT_SECRET',
  'CARD_TOKEN_PEPPER',
  'INTOUCH_ENV',
  'INTOUCH_USERNAME',
  'INTOUCH_ACCOUNT_NO',
  'INTOUCH_PARTNER_PASSWORD',
  'INTOUCH_CALLBACK_URL',
  'PIN_MAX_ATTEMPTS',
  'PIN_LOCK_MINUTES',
];
const payload = {};
for (const key of keys) {
  if (typeof vars[key] === 'string' && vars[key].length > 0) payload[key] = vars[key];
}
const file = path.join(os.tmpdir(), `ekofi-secrets-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify(payload));
try {
  execSync(`npx wrangler secret bulk ${file}`, { stdio: 'inherit' });
} finally {
  fs.unlinkSync(file);
}
console.log(`uploaded ${Object.keys(payload).length} secrets`);
