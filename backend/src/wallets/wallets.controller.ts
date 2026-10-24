import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FinanceService } from '../finance/finance.service';
import { TestCreditDto } from './dto/test-credit.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly finance: FinanceService,
  ) {}

  @Get('student/:studentId')
  getByStudent(@Param('studentId') studentId: string) {
    return this.walletsService.getByStudent(studentId);
  }

  @Post('student/:studentId/test-credit')
  @Roles(UserRole.ADMIN)
  testCredit(
    @Param('studentId') studentId: string,
    @Body() dto: TestCreditDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.testCredit({
      studentId,
      amountRwf: dto.amountRwf,
      description: dto.description,
      idempotencyKey: dto.idempotencyKey ?? this.finance.newIdempotencyKey(),
      actorId: user.id,
    });
  }
}
