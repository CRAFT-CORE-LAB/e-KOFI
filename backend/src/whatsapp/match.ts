import { amountInRange, parseAmountRwf } from './amount';

/**
 * Helpers for messages that arrive on Shaka's WhatsApp number. A parent can name the
 * student and the school in plain words ("send 5000 to Keza Uwase at Green Hills"),
 * so these find the school, the student's names and the amount in free text.
 */

/** Words that say nothing about which school is meant. */
const SCHOOL_FILLER = new Set([
  'school',
  'schools',
  'academy',
  'college',
  'secondary',
  'primary',
  'nursery',
  'high',
  'international',
  'the',
  'of',
  'de',
  'du',
  'la',
  'le',
  'des',
  'and',
  'ecole',
  'groupe',
  'scolaire',
  'lycee',
  'gs',
  'es',
  'ep',
  'tss',
  'ishuri',
  'rya',
  'ya',
]);

/** Lowercase words with accents and punctuation removed. */
export function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** The words of a school name that tell it apart, e.g. "Green Hills Academy" -> green, hills. */
export function schoolKeywords(name: string): string[] {
  const all = words(name);
  const telling = all.filter((word) => !SCHOOL_FILLER.has(word));
  return telling.length ? telling : all;
}

/** True when every telling word of the school's name is in the message. */
export function mentionsSchool(text: string, schoolName: string): boolean {
  const said = new Set(words(text));
  const keys = schoolKeywords(schoolName);
  return keys.length > 0 && keys.every((key) => said.has(key));
}

/** True when the student's first and last names (every word of each) are in the message. */
export function mentionsStudent(text: string, firstName: string, lastName: string): boolean {
  const said = new Set(words(text));
  const names = [...words(firstName), ...words(lastName)];
  return names.length >= 2 && names.every((name) => said.has(name));
}

/** Words that could be part of a person's name: letters only, two or more of them. */
export function nameCandidates(text: string): string[] {
  return [...new Set(words(text).filter((word) => /^[a-z]{2,}$/.test(word) && !SCHOOL_FILLER.has(word)))];
}

/** Spellings to try against names stored as typed by the school: keza, Keza, KEZA. */
export function nameVariants(word: string): string[] {
  const capital = word.charAt(0).toUpperCase() + word.slice(1);
  return [...new Set([word, capital, word.toUpperCase()])];
}

/**
 * An amount written anywhere in a longer message ("send 5,000 to Keza", "10k for lunch").
 * Phone numbers and long codes are skipped. Returns null unless it is a valid top-up amount.
 */
export function amountInText(text: string): number | null {
  const cleaned = text
    .replace(/(?:\+?250|0)?7\d{8}\b/g, ' ')
    .replace(/\b[A-Za-z]{1,8}[-/][A-Za-z0-9-]{2,24}\b/g, ' ');
  const pieces = cleaned.match(/\d{1,3}(?:[.,\s]\d{3})+(?!\d)|\d+\s*k\b|\d+/gi) ?? [];
  for (const piece of pieces) {
    const parsed = parseAmountRwf(piece);
    if (parsed.ok && amountInRange(parsed.value)) return parsed.value;
  }
  const spelled = parseAmountRwf(cleaned.replace(/\d+/g, ' '));
  if (spelled.ok && amountInRange(spelled.value)) return spelled.value;
  return null;
}

/** Words that mean the message is about e-KOFI, in English, French or Kinyarwanda. */
const ABOUT_EKOFI =
  /\b(e-?kofi|ekofi|e-?coffee|student|students|pupil|school|wallet|balance|top[\s-]?up|deposit|lunch|canteen|pocket money|send money|add money|umunyeshuri|abanyeshuri|ishuri|amafaranga|ikofi|kohereza|elev?e|ecole|solde|portefeuille)\b/i;

export function soundsLikeEkofi(text: string): boolean {
  return ABOUT_EKOFI.test(text);
}
