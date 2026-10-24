import { Module } from '@nestjs/common';
import { IntouchService } from '../intouch/intouch.service';
import { CanteensController } from './canteens.controller';
import { CanteensService } from './canteens.service';

@Module({
  controllers: [CanteensController],
  providers: [CanteensService, IntouchService],
})
export class CanteensModule {}
