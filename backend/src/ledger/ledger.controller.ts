import { Controller, Get, NotFoundException, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('export')
  async exportPaidMeals(@Query('canteenId') canteenId: string | undefined, @Res() res: Response) {
    const csv = await this.ledgerService.paidMealsCsv(canteenId?.trim() || undefined);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ekofi-paid-meals-${day}.csv"`);
    res.send(csv);
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
