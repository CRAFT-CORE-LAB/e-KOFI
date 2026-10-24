import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { FinanceService } from './finance.service';

@Module({
  imports: [CardsModule],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
