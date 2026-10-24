import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FinanceService } from '../finance/finance.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ReversePurchaseDto } from './dto/reverse-purchase.dto';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly finance: FinanceService) {}

  @Post()
  @Roles(UserRole.CASHIER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: AuthUser) {
    return this.finance.purchase({
      ...dto,
      actorId: user.id,
    });
  }

  @Post(':id/reverse')
  @Roles(UserRole.CASHIER)
  reverse(
    @Param('id') id: string,
    @Body() dto: ReversePurchaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.reverse({
      eventId: id,
      idempotencyKey: dto.idempotencyKey,
      description: dto.description,
      actorId: user.id,
    });
  }
}
