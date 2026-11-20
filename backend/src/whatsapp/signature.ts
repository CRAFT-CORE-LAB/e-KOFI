import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWhatsAppSignature(raw: Buffer, header: string | undefined, secret: string) {
  if (!header || !secret || raw.length === 0) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
