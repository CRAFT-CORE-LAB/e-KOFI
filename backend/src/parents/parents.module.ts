import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { ParentSessionGuard } from './parent-session.guard';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [ParentsController],
  providers: [ParentsService, ParentSessionGuard],
})
export class ParentsModule {}
