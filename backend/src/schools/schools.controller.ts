import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  list() {
    return this.schoolsService.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Post(':id/classes')
  @Roles(UserRole.ADMIN)
  createClass(@Param('id') id: string, @Body() dto: CreateClassDto) {
    return this.schoolsService.createClass(id, dto);
  }
}
