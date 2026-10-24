import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [FinanceModule],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
