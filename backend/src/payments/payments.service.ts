import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentIntent } from '@prisma/client';
import { PaymentIntentStatus } from '../domain/enums';
import { FinanceService } from '../finance/finance.service';
import { IntouchService, IntouchStatus } from '../intouch/intouch.service';
import { PrismaService } from '../prisma/prisma.service';
import { TOPUP_MAX_RWF, TOPUP_MIN_RWF } from '../whatsapp/amount';
import { splitGross } from './fee';

export type PaymentChannel = 'PARENT_PORTAL' | 'WHATSAPP' | 'ADMIN_MANUAL';

export type PaymentSettlement = {
  requestId: string;
  status: string;
  studentId: string;
  grossRwf: number;
  feeRwf: number;
  studentCreditRwf: number;
  channel: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private cachedActorId?: string;
  private settlementHandler?: (event: PaymentSettlement) => Promise<void>;

  setSettlementHandler(handler: (event: PaymentSettlement) => Promise<void>) {
    this.settlementHandler = handler;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly intouch: IntouchService,
    private readonly config: ConfigService,
  ) {}

  async startParentTopUp(
    studentId: string,
    grossRwf: number,
    mobilePhone: string,
    idempotencyKey: string,
    payer: 'parent' | 'student' = 'parent',
    channel: PaymentChannel = 'PARENT_PORTAL',
  ) {
    if (!Number.isInteger(grossRwf) || grossRwf < TOPUP_MIN_RWF || grossRwf > TOPUP_MAX_RWF) {
      throw new BadRequestException(
        `Enter an amount between ${TOPUP_MIN_RWF.toLocaleString('en-US')} and ${TOPUP_MAX_RWF.toLocaleString('en-US')} RWF.`,
      );
    }
    const { feeRwf, studentCreditRwf } = splitGross(grossRwf);
    if (studentCreditRwf < 1) {
      throw new BadRequestException('That amount is too small after the service fee.');
    }

    const existing = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === PaymentIntentStatus.PENDING) {
        return this.refresh(existing.requestId, existing.studentId);
      }
      return this.view(existing);
    }

    const phone = this.intouch.configured()
      ? this.intouch.normalizePhone(mobilePhone)
      : mobilePhone.trim();

    const intent = await this.prisma.paymentIntent.create({
      data: {
        requestId: idempotencyKey,
        idempotencyKey,
        studentId,
        grossRwf,
        feeRwf,
        studentCreditRwf,
        phone,
        payer,
        channel,
      },
    });

    if (!this.intouch.configured()) {
      if (this.config.get('PARENT_TOPUP_DIRECT') === 'true') {
        return this.applySuccess(intent, {
          pending: false,
          success: true,
          failed: false,
          responseCode: 'DIRECT',
          status: 'Successfull',
          transactionId: `direct-${idempotencyKey}`,
          referenceNo: null,
          statusDesc: 'Direct credit without Intouch',
          message: null,
        });
      }
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.FAILED, statusDesc: 'Intouch is not configured' },
      });
      throw new BadRequestException(
        'Mobile money top-up is not available yet. Please contact the school to add money to the wallet.',
      );
    }

    await this.ensureFeeAccount();
    let started: Awaited<ReturnType<IntouchService['requestPayment']>>;
    try {
      started = await this.intouch.requestPayment(grossRwf, phone, idempotencyKey, 'e-KOFI lunch money');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mobile money could not start the payment.';
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.FAILED, statusDesc: message },
      });
      throw error;
    }
    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        intouchRef: started.transactionId,
        responseCode: started.responseCode,
        statusDesc: started.statusDesc,
      },
    });
    if (started.success) {
      return this.applySuccess(intent, started);
    }
    return {
      status: 'PENDING' as const,
      requestId: intent.requestId,
      message: started.message || 'Approve the payment on your phone.',
      grossRwf,
      feeRwf,
      studentCreditRwf,
    };
  }

  async refresh(requestId: string, studentId: string) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { requestId } });
    if (!intent || intent.studentId !== studentId) {
      throw new NotFoundException('Top-up not found.');
    }
    if (intent.status !== PaymentIntentStatus.PENDING) {
      return this.view(intent);
    }
    if (!this.intouch.configured()) {
      return this.view(intent);
    }
    const status = await this.intouch.getTransactionStatus(requestId, intent.intouchRef);
    if (status.success) return this.applySuccess(intent, status);
    if (status.failed) {
      const failed = await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PaymentIntentStatus.FAILED,
          responseCode: status.responseCode,
          statusDesc: status.statusDesc,
          intouchRef: status.transactionId ?? intent.intouchRef,
        },
      });
      return this.view(failed);
    }
    return {
      status: 'PENDING' as const,
      requestId: intent.requestId,
      message: status.message || 'Still waiting for approval on the phone.',
      grossRwf: intent.grossRwf,
      feeRwf: intent.feeRwf,
      studentCreditRwf: intent.studentCreditRwf,
    };
  }

  /**
   * Intouch calls this when a payment finishes, but the endpoint is public and request
   * IDs can be guessed (WhatsApp uses wa:<phone>:<attempt>), so the body is only a hint
   * about which payment to look at. Whether it succeeded or failed is asked of Intouch
   * itself, the same check the parent portal's refresh uses. A forged "Successfull"
   * callback therefore credits nothing, and a forged "Failed" cannot cancel a real payment.
   */
  async handleCallback(body: Record<string, unknown>) {
    const payload = (body.jsonpayLoad ?? body.jsonpayload ?? body) as Record<string, unknown>;
    const requestId = String(payload.requesttransactionid ?? body.requesttransactionid ?? '');
    if (!requestId) {
      return { message: 'success', success: true, request_id: '' };
    }
    const intent = await this.prisma.paymentIntent.findUnique({ where: { requestId } });
    if (!intent) {
      return { message: 'success', success: true, request_id: requestId };
    }
    if (intent.status === PaymentIntentStatus.PENDING) {
      const status = await this.confirmedStatus(intent.requestId, intent.intouchRef);
      if (status?.success) await this.applySuccess(intent, status);
      else if (status?.failed) {
        await this.prisma.paymentIntent.updateMany({
          where: { id: intent.id, status: PaymentIntentStatus.PENDING },
          data: {
            status: PaymentIntentStatus.FAILED,
            responseCode: status.responseCode,
            statusDesc: status.statusDesc,
            intouchRef: status.transactionId ?? intent.intouchRef,
          },
        });
      }
    }
    await this.settle(intent.id);
    return { message: 'success', success: true, request_id: requestId };
  }

  /** Intouch's own answer for a payment, or null when it cannot be asked (it then stays pending). */
  private async confirmedStatus(requestId: string, intouchRef: string | null) {
    if (!this.intouch.configured()) return null;
    try {
      return await this.intouch.getTransactionStatus(requestId, intouchRef);
    } catch (error) {
      this.logger.warn(
        `Intouch status check failed for ${requestId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  async platformWallet() {
    const account = await this.ensureFeeAccount();
    const recent = await this.prisma.paymentIntent.findMany({
      where: { status: PaymentIntentStatus.POSTED },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { student: { select: { studentCode: true, firstName: true, lastName: true } } },
    });
    const withdrawals = await this.prisma.financialEvent.findMany({
      where: { type: 'PLATFORM_WITHDRAWAL', status: 'POSTED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      balanceRwf: account.balanceRwf,
      fees: recent.map((row) => ({
        id: row.id,
        type: 'FEE',
        feeRwf: row.feeRwf,
        grossRwf: row.grossRwf,
        studentCode: row.student.studentCode,
        studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
        channel: row.channel,
        requestId: row.requestId,
        when: row.updatedAt.toISOString(),
      })),
      withdrawals: withdrawals.map((row) => ({
        id: row.id,
        type: 'WITHDRAWAL',
        amountRwf: row.amountRwf,
        description: row.description,
        when: row.createdAt.toISOString(),
      })),
    };
  }

  async listIntents(studentId?: string) {
    const rows = await this.prisma.paymentIntent.findMany({
      where: studentId ? { studentId } : {},
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        student: {
          select: {
            studentCode: true,
            firstName: true,
            lastName: true,
            school: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((row) => this.intentSummary(row));
  }

  async withdrawPlatform(amountRwf: number, mobilePhone: string, actorId: string, idempotencyKey: string) {
    if (!Number.isInteger(amountRwf) || amountRwf < 100) {
      throw new BadRequestException('Enter at least 100 RWF to withdraw.');
    }
    if (!this.intouch.configured()) {
      throw new BadRequestException(
        'Intouch Pay is not connected yet. Add the Intouch username, account number, and password on the server.',
      );
    }
    const duplicate = await this.prisma.financialEvent.findUnique({ where: { idempotencyKey } });
    if (duplicate) {
      return { ok: true, duplicate: true, message: 'This withdrawal was already sent.' };
    }
    const account = await this.ensureFeeAccount();
    const debit = await this.prisma.platformFeeAccount.updateMany({
      where: { id: account.id, balanceRwf: { gte: amountRwf } },
      data: { balanceRwf: { decrement: amountRwf } },
    });
    if (debit.count !== 1) {
      throw new BadRequestException('Fee balance is not enough for this withdrawal.');
    }
    try {
      const payout = await this.intouch.sendPayout(amountRwf, mobilePhone, idempotencyKey, 'e-KOFI service fee withdrawal');
      const event = await this.prisma.financialEvent.create({
        data: {
          type: 'PLATFORM_WITHDRAWAL',
          amountRwf,
          description: `Service fee payout to ${payout.phone}`,
          idempotencyKey,
          createdById: actorId,
          entries: {
            create: [
              {
                accountType: 'PLATFORM_FEE',
                side: 'DEBIT',
                amountRwf,
                platformFeeAccountId: account.id,
              },
              { accountType: 'INTOUCH_PAYOUT', side: 'CREDIT', amountRwf },
            ],
          },
        },
      });
      const updated = await this.prisma.platformFeeAccount.findUniqueOrThrow({ where: { id: account.id } });
      return { ok: true, event, balanceRwf: updated.balanceRwf, phone: payout.phone, referenceId: payout.referenceId };
    } catch (error) {
      await this.prisma.platformFeeAccount.update({
        where: { id: account.id },
        data: { balanceRwf: { increment: amountRwf } },
      });
      throw error;
    }
  }

  private async applySuccess(intent: PaymentIntent, status: IntouchStatus) {
    const current = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    if (current.status === PaymentIntentStatus.POSTED) return this.view(current);
    if (current.status === PaymentIntentStatus.FAILED) return this.view(current);
    await this.ensureFeeAccount();
    const actorId = await this.systemActorId();
    const paidBy =
      current.channel === 'WHATSAPP'
        ? 'WhatsApp parent'
        : current.payer === 'student'
          ? 'Student'
          : 'Parent';
    const reference = current.channel === 'WHATSAPP' ? ` · ref ${current.requestId}` : '';
    const settled = await this.finance.parentTopUp({
      studentId: current.studentId,
      grossRwf: current.grossRwf,
      feeRwf: current.feeRwf,
      studentCreditRwf: current.studentCreditRwf,
      idempotencyKey: current.idempotencyKey,
      actorId,
      description: `${paidBy} paid ${current.grossRwf} RWF · ${current.studentCreditRwf} to student · ${current.feeRwf} service fee${reference}`,
    });
    const updated = await this.prisma.paymentIntent.update({
      where: { id: current.id },
      data: {
        status: PaymentIntentStatus.POSTED,
        responseCode: status.responseCode,
        statusDesc: status.statusDesc,
        intouchRef: status.transactionId ?? current.intouchRef,
      },
    });
    const balanceRwf =
      'wallet' in settled && settled.wallet
        ? settled.wallet.balanceRwf
        : (await this.prisma.wallet.findUnique({ where: { studentId: current.studentId } }))?.balanceRwf ?? 0;
    return {
      ...this.view(updated),
      balanceRwf,
      message: `${current.studentCreditRwf} RWF is now on the student wallet. Service fee ${current.feeRwf} RWF.`,
    };
  }

  private view(intent: PaymentIntent) {
    return {
      status: intent.status,
      requestId: intent.requestId,
      grossRwf: intent.grossRwf,
      feeRwf: intent.feeRwf,
      studentCreditRwf: intent.studentCreditRwf,
      message:
        intent.status === PaymentIntentStatus.POSTED
          ? `${intent.studentCreditRwf} RWF was added to the student wallet. Service fee ${intent.feeRwf} RWF.`
          : intent.status === PaymentIntentStatus.FAILED
            ? intent.statusDesc || 'The payment was not approved.'
            : intent.statusDesc || 'Approve the payment on your phone.',
    };
  }

  private intentSummary(row: PaymentIntent & {
    student: { studentCode: string; firstName: string; lastName: string; school: { name: string } };
  }) {
    return {
      id: row.id,
      requestId: row.requestId,
      status: row.status,
      channel: row.channel,
      grossRwf: row.grossRwf,
      feeRwf: row.feeRwf,
      studentCreditRwf: row.studentCreditRwf,
      phone: row.phone,
      payer: row.payer,
      intouchRef: row.intouchRef,
      responseCode: row.responseCode,
      statusDesc: row.statusDesc,
      studentCode: row.student.studentCode,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      schoolName: row.student.school.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async settle(intentId: string) {
    if (!this.settlementHandler) return;
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent || (intent.status !== PaymentIntentStatus.POSTED && intent.status !== PaymentIntentStatus.FAILED)) {
      return;
    }
    try {
      await this.settlementHandler({
        requestId: intent.requestId,
        status: intent.status,
        studentId: intent.studentId,
        grossRwf: intent.grossRwf,
        feeRwf: intent.feeRwf,
        studentCreditRwf: intent.studentCreditRwf,
        channel: intent.channel,
      });
    } catch {
      return;
    }
  }

  private async ensureFeeAccount() {
    const existing = await this.prisma.platformFeeAccount.findFirst();
    if (existing) return existing;
    return this.prisma.platformFeeAccount.create({ data: { balanceRwf: 0 } });
  }

  private async systemActorId() {
    if (this.cachedActorId) return this.cachedActorId;
    const email = this.config.get<string>('PARENT_PORTAL_ACTOR_EMAIL') ?? 'parent-portal@ekofi.system';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Parent portal is not ready on the server yet.');
    }
    this.cachedActorId = user.id;
    return user.id;
  }
}
