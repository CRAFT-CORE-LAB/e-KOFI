import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntouchService } from './intouch.service';

const SECRET = 'bridge-secret';

function service(extra: Record<string, string> = {}) {
  const values: Record<string, string> = {
    SHAKA_PAY_URL: 'https://shaka.test/api/bridge/ekofi/',
    SHAKA_BRIDGE_SECRET: SECRET,
    ...extra,
  };
  return new IntouchService({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('IntouchService through Shaka', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('asks Shaka to start the payment, signed, without any e-KOFI Intouch login', async () => {
    const calls: { url: string; body: string; signature: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      calls.push({ url, body: String(init?.body), signature: headers['X-Ekofi-Signature'] });
      return new Response(JSON.stringify({ success: true, responsecode: '1000', status: 'Pending', transactionid: '77' }));
    }) as unknown as typeof fetch;
    const intouch = service();
    expect(intouch.configured()).toBe(true);
    const started = await intouch.requestPayment(600, '0792431896', 'wa:250792431896:2', 'e-KOFI lunch money');
    expect(started.pending).toBe(true);
    expect(started.transactionId).toBe('77');
    expect(calls[0].url).toBe('https://shaka.test/api/bridge/ekofi/pay');
    expect(JSON.parse(calls[0].body)).toEqual({
      requestId: 'wa:250792431896:2',
      amount: 600,
      phone: '250792431896',
      reason: 'e-KOFI lunch money',
    });
    expect(calls[0].signature).toBe(`sha256=${createHmac('sha256', SECRET).update(calls[0].body).digest('hex')}`);
  });

  it('checks the status through Shaka and reads its Intouch-shaped reply', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: true, responsecode: '01', status: 'Successfull', transactionid: '77' })),
    ) as unknown as typeof fetch;
    const status = await service().getTransactionStatus('wa:250792431896:2', '77');
    expect(status.success).toBe(true);
  });

  it('throws (so the payment stays pending) when Shaka does not know the payment', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'Unknown payment' }), { status: 404 })) as unknown as typeof fetch;
    await expect(service().getTransactionStatus('nope')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('asks Shaka to pay out, signed, and reports a paid payout', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ success: true, responsecode: '2001', status: 'Successfull', referenceid: 'ref-9' }));
    }) as unknown as typeof fetch;
    const paid = await service().sendPayout(1000, '0788123456', 'w-1', 'e-KOFI canteen withdrawal');
    expect(paid).toEqual({ referenceId: 'ref-9', responseCode: '2001', phone: '250788123456', pending: false });
    expect(urls).toEqual(['https://shaka.test/api/bridge/ekofi/payout']);
  });

  it('throws (so e-KOFI gives the balance back) when Shaka refuses over the cap', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'That is more than e-KOFI has at Shaka' }), { status: 409 }),
    ) as unknown as typeof fetch;
    await expect(service().sendPayout(1000, '0788123456', 'w-2', 'fee')).rejects.toThrow('more than e-KOFI has');
  });

  it('keeps an unclear payout pending instead of giving the balance back', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const unclear = await service().sendPayout(1000, '0788123456', 'w-3', 'fee');
    expect(unclear.pending).toBe(true);
  });

  it('gives the balance back only when Shaka says it never started the payout', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/payout')) return new Response('oops', { status: 502 });
      return new Response(JSON.stringify({ ok: false, error: 'Unknown payout' }), { status: 404 });
    }) as unknown as typeof fetch;
    await expect(service().sendPayout(1000, '0788123456', 'w-4', 'fee')).rejects.toThrow('No money was sent');
  });
});
