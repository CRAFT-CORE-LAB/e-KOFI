import { createHmac } from 'crypto';
import { verifyWhatsAppSignature } from './signature';

describe('WhatsApp webhook signature', () => {
  const secret = 'app-secret';
  const body = Buffer.from('{"entry":[]}');
  const header = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts a Meta signature and rejects a missing or wrong one', () => {
    expect(verifyWhatsAppSignature(body, header, secret)).toBe(true);
    expect(verifyWhatsAppSignature(body, header, 'other-secret')).toBe(false);
    expect(verifyWhatsAppSignature(body, undefined, secret)).toBe(false);
    expect(verifyWhatsAppSignature(Buffer.from(''), header, secret)).toBe(false);
  });
});
