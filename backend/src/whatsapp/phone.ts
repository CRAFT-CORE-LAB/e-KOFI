export function canonicalPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `250${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `250${digits}`;
  return digits;
}

export function looksLikeRwandaPhone(raw: string) {
  const compact = raw.trim();
  if (/[a-z]/i.test(compact.replace(/rwf|frw/gi, ''))) return false;
  const digits = compact.replace(/\D/g, '');
  return /^(?:2507\d{8}|07\d{8}|7\d{8})$/.test(digits);
}

export function rwandaMobileOrNull(raw: string) {
  if (!looksLikeRwandaPhone(raw)) return null;
  const phone = canonicalPhone(raw);
  return /^2507\d{8}$/.test(phone) ? phone : null;
}
