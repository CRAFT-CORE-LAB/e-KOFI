import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../domain/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('intents')
  intents(@Query('studentId') studentId?: string) {
    return this.payments.listIntents(studentId?.trim() || undefined);
  }
}
