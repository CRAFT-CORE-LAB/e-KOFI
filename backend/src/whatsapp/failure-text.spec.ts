jest.mock('../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
jest.mock('../payments/payments.service', () => ({ PaymentsService: class PaymentsService {} }));
jest.mock('../guardians/guardians.service', () => ({ GuardiansService: class GuardiansService {} }));

import { BadRequestException } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

describe('what a parent reads when a payment cannot start', () => {
  const service = new WhatsAppService(
    ...([{}, { get: () => undefined }, {}, {}, {}, {}] as unknown as ConstructorParameters<typeof WhatsAppService>),
  );
  const text = (error: unknown) =>
    (service as unknown as { failureText: (e: unknown, a: number) => string }).failureText(error, 600);

  it('never shows Intouch or server errors', () => {
    const shown = text(new BadRequestException('Intouch Pay returned 403: No such user.'));
    expect(shown).not.toContain('403');
    expect(shown).not.toContain('Intouch');
    expect(shown).toContain('No money was taken');
    expect(text(new Error('boom'))).toContain('600 RWF');
  });

  it('passes on messages written for parents', () => {
    expect(text(new BadRequestException('Enter an amount between 100 and 500,000 RWF.'))).toBe(
      'Enter an amount between 100 and 500,000 RWF.',
    );
  });
});
