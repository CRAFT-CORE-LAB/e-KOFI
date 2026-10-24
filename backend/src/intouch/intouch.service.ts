import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class IntouchService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.username && this.accountNo && this.partnerPassword);
  }

  async sendPayout(amountRwf: number, mobilePhone: string, requestId: string, reason: string) {
    if (!this.configured()) {
      throw new BadRequestException(
        'Intouch Pay is not connected yet. Add the Intouch username, account number, and password on the server.',
      );
    }
    const phone = this.normalizePhone(mobilePhone);
    const timestamp = this.utcStamp();
    const password = createHash('sha256')
      .update(`${this.username}${this.accountNo}${this.partnerPassword}${timestamp}`)
      .digest('hex');
    const body = {
      username: this.username,
      timestamp,
      amount: String(amountRwf),
      password,
      mobilephone: phone,
      requesttransactionid: requestId,
      accountno: this.accountNo,
      withdrawcharge: '0',
      reason,
    };
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/requestdeposit/`;
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
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      responsecode?: string;
      referenceid?: string;
      message?: string;
    };
    if (!response.ok || data.success === false) {
      throw new BadRequestException(
        data.message || `Intouch Pay could not send the money (${data.responsecode ?? response.status}).`,
      );
    }
    return {
      referenceId: data.referenceid ?? requestId,
      responseCode: data.responsecode ?? String(response.status),
      phone,
    };
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

  private utcStamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
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
  private get baseUrl() {
    return this.config.get<string>('INTOUCH_BASE_URL')?.trim() || 'https://www.intouchpay.co.rw';
  }
}
