import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { StudentSessionGuard } from './student-session.guard';

@Module({
  imports: [AuthModule],
  controllers: [StudentPortalController],
  providers: [StudentPortalService, StudentSessionGuard],
})
export class StudentPortalModule {}
