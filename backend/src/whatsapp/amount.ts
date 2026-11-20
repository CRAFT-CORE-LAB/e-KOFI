export const TOPUP_MIN_RWF = 500;
export const TOPUP_MAX_RWF = 500_000;

const SMALL: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
};

export function parseAmountRwf(text: string): { ok: true; value: number } | { ok: false } {
  const source = text.toLowerCase().replace(/rwf|frw|francs?/g, ' ');
  const shorthand = source.match(/\b(\d{1,3})\s*k\b/);
  if (shorthand) {
    return { ok: true, value: Number(shorthand[1]) * 1000 };
  }
  const words = source.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\s+thousand\b/,
  );
  if (words) {
    return { ok: true, value: SMALL[words[1]] * 1000 };
  }
  const match = source.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d+)([.,]\d+)?/);
  if (!match) return { ok: false };
  if (match[2] && !/^[.,]0+$/.test(match[2])) return { ok: false };
  let raw = match[1].replace(/\s/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    raw = raw.replace(/[.,]/g, '');
  } else if (/[.,]/.test(raw)) {
    return { ok: false };
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return { ok: false };
  return { ok: true, value };
}

export function amountInRange(value: number) {
  return Number.isInteger(value) && value >= TOPUP_MIN_RWF && value <= TOPUP_MAX_RWF;
}
