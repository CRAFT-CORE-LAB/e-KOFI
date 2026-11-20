import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { GuardiansService } from '../guardians/guardians.service';
import { PaymentIntentStatus } from '../domain/enums';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppAiService } from './ai.service';
import { WhatsAppCloudService } from './cloud.service';
import * as copy from './copy';
import { applyTurn, type EngineDeps, type EngineResult } from './engine';
import type { InboundMessage } from './inbound';
import { extractStudentCode } from './intent';
import { soundsLikeEkofi } from './match';
import { canonicalPhone } from './phone';
import { blankSession, WaSession, WaState } from './states';

type ConversationRow = {
  id: string;
  waPhone: string;
  state: string;
  revision: number;
  studentId: string | null;
  schoolId: string | null;
  studentCode: string | null;
  studentName: string | null;
  className: string | null;
  schoolName: string | null;
  pendingStudentId: string | null;
  amountRwf: number | null;
  payPhone: string | null;
  paymentAttempt: number;
  paymentRequestId: string | null;
  notifiedStatus: string | null;
  linkFailures: number;
  expiresAt: Date;
};

const OUR_BUTTONS = new Set(['confirm_student', 'reject_student', 'confirm_payment', 'cancel_payment']);

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly guardians: GuardiansService,
    private readonly payments: PaymentsService,
    private readonly ai: WhatsAppAiService,
    private readonly cloud: WhatsAppCloudService,
  ) {}

  /**
   * Shaka's WhatsApp number carries Shaka's own customers as well as e-KOFI parents and
   * students, so Shaka asks before handing a message over. A conversation in progress,
   * one of our buttons, a number linked to (or that paid for) a student, or a real
   * student ID is always ours. Words like "school" or "balance", or a school's name,
   * count only when Shaka has not been talking to that number about its own business.
   */
  async claims(message: InboundMessage, shakaLead: boolean): Promise<boolean> {
    const waPhone = canonicalPhone(message.from);
    if (!/^\d{9,15}$/.test(waPhone)) return false;
    if (message.buttonId && OUR_BUTTONS.has(message.buttonId)) return true;
    const convo = await this.prisma.whatsAppConversation.findUnique({ where: { waPhone } });
    if (convo) {
      if (convo.state === WaState.PAYMENT_PENDING || convo.state === WaState.PAYMENT_INITIATED) return true;
      if (convo.state !== WaState.INITIAL && convo.expiresAt.getTime() > Date.now()) return true;
    }
    if ((await this.guardians.known(waPhone)).length) return true;
    const text = message.text.trim();
    if (!text) return false;
    const code = extractStudentCode(text);
    if (code && /[A-Z]/i.test(code) && /\d/.test(code) && (await this.guardians.hasStudentCode(code))) return true;
    if (shakaLead) return false;
    if (soundsLikeEkofi(text)) return true;
    return this.guardians.namesSchool(text);
  }

  async handleInbound(message: InboundMessage) {
    const waPhone = canonicalPhone(message.from);
    if (!/^\d{9,15}$/.test(waPhone)) return;
    const convo = await this.ensure(waPhone);
    if (await this.alreadyReceived(message.id)) return;
    try {
      await this.prisma.whatsAppMessage.create({
        data: {
          conversationId: convo.id,
          direction: 'IN',
          waMessageId: message.id,
          body: message.text.slice(0, 2000),
          kind: message.kind,
          status: 'received',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }

    try {
      if (message.kind !== 'text' && message.kind !== 'button') {
        await this.dispatch(convo.id, waPhone, "Please send a text message. I can send money to a student's e-KOFI wallet or show a balance.");
        return;
      }
      const session = this.toSession(convo);
      const intent = await this.ai.interpret(session.state, message.text, message.buttonId);
      const outcome = await applyTurn(session, intent, this.deps(), message.text);
      await this.finish(convo, outcome);
    } catch (error) {
      await this.prisma.whatsAppMessage.deleteMany({ where: { waMessageId: message.id } });
      throw error;
    }
  }

  private async finish(convo: ConversationRow, outcome: EngineResult) {
    if (outcome.effect === 'initiate_payment') {
      await this.initiate(convo, outcome);
      return;
    }
    if (outcome.effect === 'refresh_payment' && outcome.session.paymentRequestId && outcome.session.studentId) {
      await this.refresh(convo, outcome);
      return;
    }
    const saved = await this.prisma.whatsAppConversation.updateMany({
      where: { id: convo.id, revision: convo.revision },
      data: { ...this.persist(outcome.session), revision: { increment: 1 } },
    });
    if (saved.count !== 1) {
      await this.dispatch(convo.id, convo.waPhone, 'Please send that message once more.');
      return;
    }
    await this.dispatch(convo.id, convo.waPhone, outcome.text, outcome.buttons);
  }

  private async initiate(convo: ConversationRow, outcome: EngineResult) {
    const session = outcome.session;
    if (!session.studentId || session.amountRwf == null) return;
    const attempt = session.paymentAttempt + 1;
    const requestId = `wa:${session.waPhone}:${attempt}`;
    const phone = session.payPhone || session.waPhone;
    const claimed = await this.prisma.whatsAppConversation.updateMany({
      where: {
        id: convo.id,
        revision: convo.revision,
        state: WaState.AWAITING_PAYMENT_CONFIRMATION,
      },
      data: {
        ...this.persist(session),
        state: WaState.PAYMENT_INITIATED,
        paymentAttempt: attempt,
        paymentRequestId: requestId,
        payPhone: phone,
        revision: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      await this.dispatch(convo.id, session.waPhone, 'Please confirm the payment once more.', copy.buttons.payment);
      return;
    }
    try {
      const result = await this.payments.startParentTopUp(
        session.studentId,
        session.amountRwf,
        phone,
        requestId,
        'parent',
        'WHATSAPP',
      );
      const posted = result.status === PaymentIntentStatus.POSTED;
      const failed = result.status === PaymentIntentStatus.FAILED;
      const text = posted
        ? copy.paymentSuccess({
            grossRwf: result.grossRwf,
            studentCreditRwf: result.studentCreditRwf,
            feeRwf: result.feeRwf,
            name: session.studentName ?? 'the student',
            studentCode: session.studentCode ?? '',
          })
        : failed
          ? copy.paymentFailed(session.amountRwf)
          : copy.paymentPrompt(session.amountRwf);
      await this.prisma.whatsAppConversation.update({
        where: { id: convo.id },
        data: {
          state: posted ? WaState.PAYMENT_SUCCESSFUL : failed ? WaState.PAYMENT_FAILED : WaState.PAYMENT_PENDING,
          notifiedStatus: posted ? PaymentIntentStatus.POSTED : failed ? PaymentIntentStatus.FAILED : 'AWAITING',
        },
      });
      await this.dispatch(convo.id, session.waPhone, text);
    } catch (error) {
      await this.prisma.whatsAppConversation.update({
        where: { id: convo.id },
        data: { state: WaState.PAYMENT_FAILED, notifiedStatus: PaymentIntentStatus.FAILED },
      });
      await this.dispatch(convo.id, session.waPhone, this.failureText(error, session.amountRwf));
    }
  }

  private async refresh(convo: ConversationRow, outcome: EngineResult) {
    const session = outcome.session;
    const requestId = session.paymentRequestId;
    const studentId = session.studentId;
    if (!requestId || !studentId) {
      await this.dispatch(convo.id, session.waPhone, outcome.text, outcome.buttons);
      return;
    }
    try {
      const result = await this.payments.refresh(requestId, studentId);
      const posted = result.status === PaymentIntentStatus.POSTED;
      const failed = result.status === PaymentIntentStatus.FAILED;
      const text = posted
        ? copy.paymentSuccess({
            grossRwf: result.grossRwf,
            studentCreditRwf: result.studentCreditRwf,
            feeRwf: result.feeRwf,
            name: session.studentName ?? 'the student',
            studentCode: session.studentCode ?? '',
          })
        : failed
          ? copy.paymentFailed(result.grossRwf)
          : copy.paymentPending();
      await this.prisma.whatsAppConversation.updateMany({
        where: { id: convo.id, revision: convo.revision },
        data: {
          ...this.persist(session),
          state: posted ? WaState.PAYMENT_SUCCESSFUL : failed ? WaState.PAYMENT_FAILED : WaState.PAYMENT_PENDING,
          notifiedStatus: posted ? PaymentIntentStatus.POSTED : failed ? PaymentIntentStatus.FAILED : 'AWAITING',
          revision: { increment: 1 },
        },
      });
      await this.dispatch(convo.id, session.waPhone, text);
    } catch {
      await this.dispatch(convo.id, session.waPhone, copy.paymentPending());
    }
  }

  private async ensure(waPhone: string): Promise<ConversationRow> {
    const existing = await this.prisma.whatsAppConversation.findUnique({ where: { waPhone } });
    if (existing) return existing;
    const now = new Date();
    try {
      return await this.prisma.whatsAppConversation.create({
        data: {
          waPhone,
          state: WaState.INITIAL,
          expiresAt: new Date(now.getTime() + this.sessionMinutes() * 60 * 1000),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.prisma.whatsAppConversation.findUnique({ where: { waPhone } });
        if (again) return again;
      }
      throw error;
    }
  }

  private async alreadyReceived(waMessageId: string) {
    const existing = await this.prisma.whatsAppMessage.findUnique({ where: { waMessageId } });
    return Boolean(existing);
  }

  private async dispatch(
    conversationId: string,
    waPhone: string,
    text: string,
    buttons?: { id: string; title: string }[],
  ) {
    const result = await this.cloud.deliver(waPhone, text, buttons);
    await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        direction: 'OUT',
        body: text.slice(0, 2000),
        kind: buttons?.length ? 'button' : 'text',
        status: result.ok ? 'sent' : 'failed',
      },
    });
  }

  private deps(): EngineDeps {
    return {
      now: () => new Date(),
      sessionMinutes: this.sessionMinutes(),
      lookup: (code) => this.guardians.lookup(code),
      linkedStudents: (phone) => this.guardians.linked(phone),
      knownStudents: (phone) => this.guardians.known(phone),
      describe: (phone, text) => this.guardians.describe(phone, text),
      canSeeBalance: (phone, studentId) => this.guardians.canSeeBalance(phone, studentId),
      redeemLinkCode: (phone, studentId, code) => this.guardians.redeem(phone, studentId, code),
      walletBalance: (studentId) => this.guardians.balance(studentId),
    };
  }

  private sessionMinutes() {
    const raw = Number(this.config.get('WHATSAPP_SESSION_MINUTES') ?? 30);
    if (!Number.isFinite(raw)) return 30;
    return Math.min(180, Math.max(5, Math.round(raw)));
  }

  private toSession(row: ConversationRow): WaSession {
    const base = blankSession(row.waPhone, new Date(), this.sessionMinutes());
    return {
      ...base,
      state: this.asState(row.state),
      revision: row.revision,
      studentId: row.studentId,
      schoolId: row.schoolId,
      studentCode: row.studentCode,
      studentName: row.studentName,
      className: row.className,
      schoolName: row.schoolName,
      pendingStudentId: row.pendingStudentId,
      amountRwf: row.amountRwf,
      payPhone: row.payPhone,
      paymentAttempt: row.paymentAttempt,
      paymentRequestId: row.paymentRequestId,
      notifiedStatus: row.notifiedStatus,
      linkFailures: row.linkFailures,
      expiresAt: row.expiresAt,
    };
  }

  private persist(session: WaSession) {
    return {
      state: session.state,
      studentId: session.studentId,
      schoolId: session.schoolId,
      studentCode: session.studentCode,
      studentName: session.studentName,
      className: session.className,
      schoolName: session.schoolName,
      pendingStudentId: session.pendingStudentId,
      amountRwf: session.amountRwf,
      payPhone: session.payPhone,
      paymentAttempt: session.paymentAttempt,
      paymentRequestId: session.paymentRequestId,
      notifiedStatus: session.notifiedStatus,
      linkFailures: session.linkFailures,
      expiresAt: session.expiresAt,
    };
  }

  private asState(value: string): WaState {
    return (Object.values(WaState) as string[]).includes(value) ? (value as WaState) : WaState.INITIAL;
  }

  private failureText(error: unknown, amountRwf: number) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(' ') : message;
      }
    }
    return copy.paymentFailed(amountRwf);
  }
}
