import { Module } from '@nestjs/common';
import { IntouchService } from './intouch.service';

@Module({
  providers: [IntouchService],
  exports: [IntouchService],
})
export class IntouchModule {}
