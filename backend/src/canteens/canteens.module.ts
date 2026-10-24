import { Module } from '@nestjs/common';
import { CanteensController } from './canteens.controller';
import { CanteensService } from './canteens.service';

@Module({
  controllers: [CanteensController],
  providers: [CanteensService],
})
export class CanteensModule {}
