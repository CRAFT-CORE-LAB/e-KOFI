import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PurchasesController } from './purchases.controller';

@Module({
  imports: [FinanceModule],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
