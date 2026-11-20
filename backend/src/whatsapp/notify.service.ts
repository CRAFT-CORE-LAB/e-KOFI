import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentIntentStatus } from '../domain/enums';
import { PaymentsService, PaymentSettlement } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppCloudService } from './cloud.service';
import * as copy from './copy';
import { rwf } from './copy';
import { WaState } from './states';

@Injectable()
export class WhatsAppNotifyService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppNotifyService.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly cloud: WhatsAppCloudService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.payments.setSettlementHandler((event) => this.notify(event));
  }

  async notify(event: PaymentSettlement) {
    if (event.channel !== 'WHATSAPP') return;
    if (event.status !== PaymentIntentStatus.POSTED && event.status !== PaymentIntentStatus.FAILED) return;
    const convo = await this.prisma.whatsAppConversation.findUnique({
      where: { paymentRequestId: event.requestId },
    });
    if (!convo || convo.notifiedStatus === event.status || convo.notifiedStatus === 'SENDING') return;
    const claimed = await this.prisma.whatsAppConversation.updateMany({
      where: { id: convo.id, notifiedStatus: convo.notifiedStatus },
      data: { notifiedStatus: 'SENDING' },
    });
    if (claimed.count !== 1) return;
    const name = convo.studentName ?? 'the student';
    const studentCode = convo.studentCode ?? '';
    const text =
      event.status === PaymentIntentStatus.POSTED
        ? copy.paymentSuccess({
            grossRwf: event.grossRwf,
            studentCreditRwf: event.studentCreditRwf,
            feeRwf: event.feeRwf,
            name,
            studentCode,
          })
        : copy.paymentFailed(event.grossRwf);
    const templateName =
      event.status === PaymentIntentStatus.POSTED
        ? this.config.get<string>('WHATSAPP_TEMPLATE_SUCCESS')?.trim()
        : this.config.get<string>('WHATSAPP_TEMPLATE_FAILED')?.trim();
    const sent = await this.cloud.deliver(
      convo.waPhone,
      text,
      undefined,
      templateName ? { name: templateName, params: [rwf(event.grossRwf), name, studentCode] } : undefined,
    );
    if (!sent.ok) {
      await this.prisma.whatsAppConversation.update({
        where: { id: convo.id },
        data: { notifiedStatus: convo.notifiedStatus },
      });
      this.logger.warn(`WhatsApp payment notice was not delivered (${String(sent.errorCode)})`);
      return;
    }
    await this.prisma.whatsAppConversation.update({
      where: { id: convo.id },
      data: {
        notifiedStatus: event.status,
        state: event.status === PaymentIntentStatus.POSTED ? WaState.PAYMENT_SUCCESSFUL : WaState.PAYMENT_FAILED,
      },
    });
    await this.prisma.whatsAppMessage.create({
      data: {
        conversationId: convo.id,
        direction: 'OUT',
        body: text.slice(0, 2000),
        kind: templateName ? 'template' : 'text',
        status: 'sent',
      },
    });
  }
}
