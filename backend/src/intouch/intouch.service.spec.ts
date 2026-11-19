import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { IntouchService } from './intouch.service';

function service() {
  const values: Record<string, string> = {
    INTOUCH_ENV: 'sandbox',
    INTOUCH_USERNAME: 'testa',
    INTOUCH_ACCOUNT_NO: '250160000011',
    INTOUCH_PARTNER_PASSWORD: 'pass123456789',
    INTOUCH_CALLBACK_URL: 'https://example.com/api/intouch/callback',
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new IntouchService(config);
}

describe('IntouchService.readStatus', () => {
  const intouch = service();

  it('keeps a collection request pending on code 1000', () => {
    const status = intouch.readStatus({
      status: 'Pending',
      success: true,
      responsecode: '1000',
      transactionid: '1425',
      message: 'Transaction Pending',
    });
    expect(status.pending).toBe(true);
    expect(status.success).toBe(false);
    expect(status.failed).toBe(false);
    expect(status.transactionId).toBe('1425');
  });

  it('treats response code 01 as a successful collection', () => {
    const status = intouch.readStatus({
      success: true,
      responsecode: '01',
      status: 'Successfull',
      message: 'Transaction Successful',
    });
    expect(status.success).toBe(true);
    expect(status.pending).toBe(false);
    expect(status.failed).toBe(false);
  });

  it('treats response code 2001 with success true as a successful deposit', () => {
    const status = intouch.readStatus({
      requesttransactionid: '1201',
      referenceid: '1123',
      responsecode: '2001',
      success: true,
    });
    expect(status.success).toBe(true);
    expect(status.pending).toBe(false);
    expect(status.transactionId).toBe('1123');
  });

  it('treats success false as a failure', () => {
    const status = intouch.readStatus({
      requesttransactionid: '1201',
      success: false,
      responsecode: '2500',
      message: 'Failed',
    });
    expect(status.failed).toBe(true);
    expect(status.success).toBe(false);
    expect(status.pending).toBe(false);
  });
});

describe('IntouchService requests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts a payment as form fields with the hashed password', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        json: async () => ({
          status: 'Pending',
          success: true,
          responsecode: '1000',
          transactionid: '1425',
        }),
      } as Response;
    }) as typeof fetch;

    const result = await service().requestPayment(1000, '0788123456', 'req-1', 'e-KOFI lunch money');
    const { url, init } = calls[0];
    const form = new URLSearchParams(String(init.body));
    const expectedPassword = createHash('sha256')
      .update(`testa250160000011pass123456789${form.get('timestamp')}`)
      .digest('hex');

    expect(url).toBe('https://developer.intouchpay.co.rw/api/v1/sandbox/requestpayment/');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(form.get('username')).toBe('testa');
    expect(form.get('accountno')).toBe('250160000011');
    expect(form.get('password')).toBe(expectedPassword);
    expect(form.get('amount')).toBe('1000');
    expect(form.get('mobilephone')).toBe('250788123456');
    expect(form.get('requesttransactionid')).toBe('req-1');
    expect(form.get('callbackurl')).toBe('https://example.com/api/intouch/callback');
    expect(result.pending).toBe(true);
    expect(result.transactionId).toBe('1425');
  });

  it('sends the stored Intouch transaction id when checking status', async () => {
    let body = '';
    global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      body = String(init?.body ?? '');
      return {
        ok: true,
        json: async () => ({ success: true, responsecode: '01', status: 'Successfull' }),
      } as Response;
    }) as typeof fetch;

    const status = await service().getTransactionStatus('req-1', '1425');
    const form = new URLSearchParams(body);
    expect(form.get('requesttransactionid')).toBe('req-1');
    expect(form.get('transactionid')).toBe('1425');
    expect(status.success).toBe(true);
  });
});
