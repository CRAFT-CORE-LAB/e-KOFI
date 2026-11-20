import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudentStatus, UserRole } from '../domain/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LinkGuardianDto } from '../guardians/dto/link-guardian.dto';
import { GuardiansService } from '../guardians/guardians.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly guardianLinks: GuardiansService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  search(@Query('q') q?: string, @Query('status') status?: StudentStatus) {
    return this.studentsService.search(q, status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.studentsService.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.studentsService.deactivate(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }

  @Get(':id/guardians')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  guardians(@Param('id') id: string) {
    return this.guardianLinks.list(id);
  }

  @Post(':id/guardians')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  linkGuardian(@Param('id') id: string, @Body() dto: LinkGuardianDto) {
    return this.guardianLinks.link(id, dto.phone, dto.label);
  }

  @Delete(':id/guardians/:guardianId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  unlinkGuardian(@Param('id') id: string, @Param('guardianId') guardianId: string) {
    return this.guardianLinks.unlink(id, guardianId);
  }

  @Post(':id/guardian-link-code')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  guardianCode(@Param('id') id: string) {
    return this.guardianLinks.issueCode(id);
  }

  @Get(':id/top-ups')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  topUps(@Param('id') id: string) {
    return this.payments.listIntents(id);
  }
}
