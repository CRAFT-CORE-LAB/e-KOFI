import { Module } from '@nestjs/common';
import { FingerprintsController } from './fingerprints.controller';
import { FingerprintsService } from './fingerprints.service';

@Module({
  controllers: [FingerprintsController],
  providers: [FingerprintsService],
  exports: [FingerprintsService],
})
export class FingerprintsModule {}
