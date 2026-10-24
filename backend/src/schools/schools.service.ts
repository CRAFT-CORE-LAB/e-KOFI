import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.school.findMany({
      orderBy: { name: 'asc' },
      include: { classes: { orderBy: { name: 'asc' } } },
    });
  }

  async create(dto: CreateSchoolDto) {
    try {
      return await this.prisma.school.create({ data: { name: dto.name.trim() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A school with this name already exists');
      }
      throw error;
    }
  }

  async createClass(schoolId: string, dto: CreateClassDto) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    try {
      return await this.prisma.class.create({
        data: { schoolId, name: dto.name.trim() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This class already exists at the school');
      }
      throw error;
    }
  }
}
