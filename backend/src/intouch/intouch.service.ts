import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

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

@Injectable()
export class IntouchService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.username && this.accountNo && this.partnerPassword);
  }

  callbackUrl() {
    const explicit = this.config.get<string>('INTOUCH_CALLBACK_URL')?.trim();
    if (explicit) return explicit;
    const base =
      this.config.get<string>('PUBLIC_API_URL')?.trim() ||
      'https://api-production-240da.up.railway.app/api';
    return `${base.replace(/\/$/, '')}/intouch/callback`;
  }

  async requestPayment(amountRwf: number, mobilePhone: string, requestId: string, reason: string) {
    const phone = this.normalizePhone(mobilePhone);
    const data = await this.post('requestpayment', {
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

  async getTransactionStatus(requestId: string): Promise<IntouchStatus> {
    const data = await this.post('gettransactionstatus', {
      requesttransactionid: requestId,
    });
    return this.readStatus(data);
  }

  async getBalance() {
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
    const success =
      responseCode === '01' ||
      lowered.includes('successfull') ||
      lowered.includes('successful') ||
      lowered.includes('successfully processed');
    const pending =
      !success &&
      (responseCode === '1000' ||
        lowered.includes('pending') ||
        lowered.includes('processing') ||
        payload.success === true && !lowered.includes('fail'));
    const failed =
      !success &&
      !pending &&
      (lowered.includes('fail') || lowered.includes('declin') || lowered.includes('cancel') || payload.success === false);
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
    const body = {
      username: this.username,
      accountno: this.accountNo,
      timestamp,
      password,
      ...extra,
    };
    const url = `${this.baseUrl}/${action}/`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new BadRequestException('Could not reach Intouch Pay. Try again in a moment.');
    }
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && !data.responsecode && !data.status) {
      throw new BadRequestException(
        (typeof data.message === 'string' && data.message) || `Intouch Pay returned ${response.status}.`,
      );
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
