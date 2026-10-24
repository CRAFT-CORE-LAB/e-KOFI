import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashCardToken(token: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${token}`).digest('hex');
}

export function generateCardToken(): string {
  return `EKOFI-${randomBytes(24).toString('base64url')}`;
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
