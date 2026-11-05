import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { IntouchModule } from '../intouch/intouch.module';
import { IntouchCallbackController } from './intouch-callback.controller';
import { PlatformController } from './platform.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [FinanceModule, IntouchModule],
  controllers: [IntouchCallbackController, PlatformController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
