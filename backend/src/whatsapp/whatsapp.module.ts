import { Module } from '@nestjs/common';
import { GuardiansModule } from '../guardians/guardians.module';
import { PaymentsModule } from '../payments/payments.module';
import { WhatsAppAiService } from './ai.service';
import { WhatsAppCloudService } from './cloud.service';
import { WhatsAppNotifyService } from './notify.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [GuardiansModule, PaymentsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppAiService, WhatsAppCloudService, WhatsAppNotifyService],
})
export class WhatsAppModule {}
