import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { StudentSessionGuard } from './student-session.guard';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [StudentPortalController],
  providers: [StudentPortalService, StudentSessionGuard],
})
export class StudentPortalModule {}
