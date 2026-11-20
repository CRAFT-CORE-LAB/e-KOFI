import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

export type IntouchStatus = {
  pending: boolean;
  success: boolean;
  failed: boolean;
  responseCode: string;
  status: string;
  transactionId: string | null;
  referenceNo: string | null;
  statusDesc: string | null;
  message: string | null;
};

/**
 * Mobile Money collections. Since 2026-11-20 they go through Shaka's IntouchPay account
 * (the owner's decision): with SHAKA_PAY_URL and SHAKA_BRIDGE_SECRET set, e-KOFI asks Shaka
 * to start and to check each payment, Shaka calls Intouch with its own login, and Intouch's
 * callback reaches Shaka, which tells e-KOFI to look again (/api/intouch/callback). Shaka's
 * replies use Intouch's own fields, so readStatus reads both. e-KOFI's own Intouch login
 * (INTOUCH_*) is used only when SHAKA_PAY_URL is not set.
 */
@Injectable()
export class IntouchService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.shakaPayUrl || (this.username && this.accountNo && this.partnerPassword));
  }

  /** True when collections go through Shaka's IntouchPay account. */
  viaShaka() {
    return Boolean(this.shakaPayUrl);
  }

  callbackUrl() {
    const explicit = this.config.get<string>('INTOUCH_CALLBACK_URL')?.trim();
    if (explicit) return explicit;
    const base =
      this.config.get<string>('PUBLIC_API_URL')?.trim() ||
      'https://ekofi-api.ekofi.workers.dev/api';
    return `${base.replace(/\/$/, '')}/intouch/callback`;
  }

  async requestPayment(amountRwf: number, mobilePhone: string, requestId: string, reason: string) {
    const phone = this.normalizePhone(mobilePhone);
    const data = this.viaShaka()
      ? await this.shaka('pay', { requestId, amount: amountRwf, phone, reason })
      : await this.post('requestpayment', {
          amount: amountRwf,
          mobilephone: phone,
          requesttransactionid: requestId,
          callbackurl: this.callbackUrl(),
          reason,
        });
    const status = this.readStatus(data);
    if (status.failed && !status.pending && !status.success) {
      throw new BadRequestException(status.message || 'Mobile money could not start the payment.');
    }
    return { ...status, phone, referenceId: status.transactionId ?? requestId };
  }

  async sendPayout(amountRwf: number, mobilePhone: string, requestId: string, reason: string) {
    if (this.viaShaka()) {
      // The money sits in Shaka's IntouchPay account; e-KOFI cannot send it out from there.
      throw new BadRequestException(
        "Top-ups are collected in Shaka's IntouchPay account, so payouts are made by Shaka, not from e-KOFI.",
      );
    }
    const phone = this.normalizePhone(mobilePhone);
    const data = await this.post('requestdeposit', {
      amount: amountRwf,
      mobilephone: phone,
      requesttransactionid: requestId,
      withdrawcharge: 0,
      reason,
    });
    const status = this.readStatus(data);
    if (!status.success && !status.pending) {
      throw new BadRequestException(
        status.message || `Intouch Pay could not send the money (${status.responseCode || 'error'}).`,
      );
    }
    return {
      referenceId: status.transactionId ?? requestId,
      responseCode: status.responseCode,
      phone,
      pending: status.pending && !status.success,
    };
  }

  async getTransactionStatus(requestId: string, transactionId?: string | null): Promise<IntouchStatus> {
    if (this.viaShaka()) return this.readStatus(await this.shaka('pay-status', { requestId }));
    const data = await this.post('gettransactionstatus', {
      requesttransactionid: requestId,
      ...(transactionId ? { transactionid: transactionId } : {}),
    });
    return this.readStatus(data);
  }

  async getBalance() {
    if (this.viaShaka()) return null;
    const data = await this.post('getbalance', {});
    const raw = data.balance ?? data.accountbalance ?? data.amount;
    const balance = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(balance) ? Math.round(balance) : null;
  }

  normalizePhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    let phone = digits;
    if (phone.startsWith('0') && phone.length === 10) phone = `250${phone.slice(1)}`;
    if (phone.length === 9 && phone.startsWith('7')) phone = `250${phone}`;
    if (!/^2507\d{8}$/.test(phone)) {
      throw new BadRequestException('Enter a valid MTN or Airtel Rwanda number.');
    }
    return phone;
  }

  readStatus(data: Record<string, unknown>): IntouchStatus {
    const payload = this.unwrap(data);
    const responseCode = String(payload.responsecode ?? payload.responseCode ?? '');
    const statusText = String(payload.status ?? '');
    const statusDesc = payload.statusdesc ? String(payload.statusdesc) : payload.message ? String(payload.message) : null;
    const lowered = `${statusText} ${statusDesc ?? ''}`.toLowerCase();
    const negative =
      lowered.includes('unsuccess') ||
      lowered.includes('fail') ||
      lowered.includes('declin') ||
      lowered.includes('cancel');
    const success =
      responseCode === '01' ||
      (responseCode === '2001' && payload.success === true) ||
      (!negative &&
        (lowered.includes('successfull') ||
          lowered.includes('successful') ||
          lowered.includes('successfully processed')));
    const pending =
      !success &&
      (responseCode === '1000' || lowered.includes('pending') || lowered.includes('processing'));
    const failed = !success && !pending && (payload.success === false || negative);
    return {
      pending: pending && !success,
      success,
      failed,
      responseCode,
      status: statusText,
      transactionId: payload.transactionid ? String(payload.transactionid) : payload.referenceid ? String(payload.referenceid) : null,
      referenceNo: payload.referenceno ? String(payload.referenceno) : null,
      statusDesc,
      message: payload.message ? String(payload.message) : statusDesc,
    };
  }

  private unwrap(data: Record<string, unknown>) {
    const wrapped = data.jsonpayLoad ?? data.jsonpayload ?? data.JsonPayLoad;
    if (wrapped && typeof wrapped === 'object') {
      return { ...data, ...(wrapped as Record<string, unknown>) };
    }
    return data;
  }

  /** A signed call to Shaka's e-KOFI payment bridge (`<SHAKA_PAY_URL>/pay`, `/pay-status`). */
  private async shaka(action: 'pay' | 'pay-status', payload: Record<string, unknown>) {
    const secret = this.config.get<string>('SHAKA_BRIDGE_SECRET')?.trim() ?? '';
    const body = JSON.stringify(payload);
    let response: Response;
    try {
      response = await fetch(`${this.shakaPayUrl}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ekofi-Signature': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
        },
        body,
      });
    } catch {
      throw new BadRequestException('Could not reach the Shaka payment service. Try again in a moment.');
    }
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && !data.responsecode && !data.status) {
      const reason = typeof data.error === 'string' ? `: ${data.error}` : '';
      throw new BadRequestException(`Shaka payment service returned ${response.status}${reason}.`);
    }
    return data;
  }

  private get shakaPayUrl() {
    const url = this.config.get<string>('SHAKA_PAY_URL')?.trim().replace(/\/$/, '') ?? '';
    return url && this.config.get<string>('SHAKA_BRIDGE_SECRET')?.trim() ? url : '';
  }

  private async post(action: string, extra: Record<string, unknown>) {
    if (!this.configured()) {
      throw new BadRequestException(
        'Intouch Pay is not connected yet. Add the Intouch username, account number, and password on the server.',
      );
    }
    const timestamp = this.utcStamp();
    const password = createHash('sha256')
      .update(`${this.username}${this.accountNo}${this.partnerPassword}${timestamp}`)
      .digest('hex');
    const form = new URLSearchParams({
      username: this.username,
      accountno: this.accountNo,
      timestamp,
      password,
    });
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null) continue;
      form.set(key, String(value));
    }
    const url = `${this.baseUrl}/${action}/`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
    } catch {
      throw new BadRequestException('Could not reach Intouch Pay. Try again in a moment.');
    }
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && !data.responsecode && !data.status) {
      // The live API answers a refused login with 403 {"detail": "No such user"}; keep that reason.
      const reason =
        (typeof data.message === 'string' && data.message) || (typeof data.detail === 'string' && data.detail) || '';
      throw new BadRequestException(`Intouch Pay returned ${response.status}${reason ? `: ${reason}` : ''}.`);
    }
    return data;
  }

  private utcStamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  }

  private get sandbox() {
    return (this.config.get<string>('INTOUCH_ENV') ?? 'sandbox').toLowerCase() !== 'production';
  }

  private get baseUrl() {
    const override = this.config.get<string>('INTOUCH_BASE_URL')?.trim();
    if (override) return override.replace(/\/$/, '');
    return this.sandbox
      ? 'https://developer.intouchpay.co.rw/api/v1/sandbox'
      : 'https://www.intouchpay.co.rw/api';
  }

  private get username() {
    return this.config.get<string>('INTOUCH_USERNAME')?.trim() ?? '';
  }
  private get accountNo() {
    return this.config.get<string>('INTOUCH_ACCOUNT_NO')?.trim() ?? '';
  }
  private get partnerPassword() {
    return this.config.get<string>('INTOUCH_PARTNER_PASSWORD')?.trim() ?? '';
  }
}
