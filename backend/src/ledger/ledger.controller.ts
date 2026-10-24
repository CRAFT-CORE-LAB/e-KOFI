import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { LedgerService } from './ledger.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  list(
    @Query('studentId') studentId?: string,
    @Query('canteenId') canteenId?: string,
    @Query('walletId') walletId?: string,
  ) {
    return this.ledgerService.list({ studentId, canteenId, walletId });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const event = await this.ledgerService.get(id);
    if (!event) {
      throw new NotFoundException('Transaction not found');
    }
    return event;
  }
}
