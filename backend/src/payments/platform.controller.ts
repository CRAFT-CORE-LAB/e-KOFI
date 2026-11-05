import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsService } from './payments.service';

class PlatformWithdrawDto {
  @Type(() => Number)
  @IsInt()
  @Min(100)
  amountRwf!: number;

  @IsString()
  @MinLength(9)
  mobilePhone!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class PlatformController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('wallet')
  wallet() {
    return this.payments.platformWallet();
  }

  @Post('withdraw')
  withdraw(@Body() dto: PlatformWithdrawDto, @CurrentUser() user: AuthUser) {
    const key = dto.idempotencyKey?.trim() || `fee-${user.id}-${Date.now()}`;
    return this.payments.withdrawPlatform(dto.amountRwf, dto.mobilePhone, user.id, key);
  }
}
