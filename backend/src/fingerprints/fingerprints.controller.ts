import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EnrollFingerprintDto } from './dto/enroll-fingerprint.dto';
import { FingerprintsService } from './fingerprints.service';

@Controller('fingerprints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FingerprintsController {
  constructor(private readonly fingerprints: FingerprintsService) {}

  @Get()
  list(@Query('studentId') studentId?: string) {
    return this.fingerprints.list(studentId);
  }

  @Get('sync')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  sync() {
    return this.fingerprints.templatesForSync();
  }

  @Post('enroll')
  @Roles(UserRole.ADMIN)
  enroll(@Body() dto: EnrollFingerprintDto) {
    return this.fingerprints.enroll(dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.fingerprints.remove(id);
  }
}
