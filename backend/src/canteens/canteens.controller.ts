import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CanteensService } from './canteens.service';
import { CreateCanteenDto } from './dto/create-canteen.dto';
import { WithdrawCanteenDto } from './dto/withdraw-canteen.dto';

@Controller('canteens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CanteensController {
  constructor(private readonly canteensService: CanteensService) {}

  @Get()
  list() {
    return this.canteensService.list();
  }

  @Post(':id/withdraw')
  @Roles(UserRole.CASHIER)
  withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawCanteenDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.canteensService.withdraw(id, dto.amountRwf, dto.mobilePhone, user.id, dto.idempotencyKey);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.canteensService.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCanteenDto) {
    return this.canteensService.create(dto);
  }
}
