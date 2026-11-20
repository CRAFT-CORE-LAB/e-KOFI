import { Module } from '@nestjs/common';
import { GuardiansModule } from '../guardians/guardians.module';
import { PaymentsModule } from '../payments/payments.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [GuardiansModule, PaymentsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
