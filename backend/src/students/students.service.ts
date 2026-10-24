import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const studentInclude = {
  school: true,
  class: true,
  wallet: true,
  cards: { orderBy: { createdAt: 'desc' as const } },
  fingerprints: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      finger: true,
      deviceModel: true,
      isActive: true,
      createdAt: true,
    },
  },
} satisfies Prisma.StudentInclude;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query?: string, status?: StudentStatus) {
    const where: Prisma.StudentWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (query?.trim()) {
      const q = query.trim();
      where.OR = [
        { studentCode: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const students = await this.prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return students.map((student) => this.sanitize(student));
  }

  async get(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return this.sanitize(student);
  }

  async create(dto: CreateStudentDto) {
    await this.assertClassBelongsToSchool(dto.classId, dto.schoolId);
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 12) : null;
    const pinEnabled = Boolean(dto.pinEnabled && pinHash);
    const studentCode = await this.nextStudentCode();

    const student = await this.prisma.student.create({
      data: {
        studentCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        schoolId: dto.schoolId,
        classId: dto.classId,
        pinHash,
        pinEnabled,
        wallet: { create: { balanceRwf: 0 } },
      },
      include: studentInclude,
    });
    return this.sanitize(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    const schoolId = dto.schoolId ?? existing.schoolId;
    const classId = dto.classId ?? existing.classId;
    if (dto.schoolId || dto.classId) {
      await this.assertClassBelongsToSchool(classId, schoolId);
    }

    const data: Prisma.StudentUpdateInput = {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      school: dto.schoolId ? { connect: { id: dto.schoolId } } : undefined,
      class: dto.classId ? { connect: { id: dto.classId } } : undefined,
      status: dto.status,
    };

    if (dto.pin) {
      data.pinHash = await bcrypt.hash(dto.pin, 12);
      data.pinFailedCount = 0;
      data.pinLockedUntil = null;
      data.pinEnabled = dto.pinEnabled ?? true;
    } else if (dto.pinEnabled !== undefined) {
      if (dto.pinEnabled && !existing.pinHash) {
        throw new BadRequestException('Set a PIN before enabling PIN authorization');
      }
      data.pinEnabled = dto.pinEnabled;
    }

    const student = await this.prisma.student.update({
      where: { id },
      data,
      include: studentInclude,
    });
    return this.sanitize(student);
  }

  async deactivate(id: string) {
    return this.update(id, { status: StudentStatus.DEACTIVATED });
  }

  private sanitize<T extends { pinHash: string | null }>(student: T) {
    const { pinHash: _pinHash, ...rest } = student;
    return { ...rest, hasPin: Boolean(student.pinHash) };
  }

  private async assertClassBelongsToSchool(classId: string, schoolId: string) {
    const schoolClass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }
    if (schoolClass.schoolId !== schoolId) {
      throw new BadRequestException('Class does not belong to the selected school');
    }
  }

  private async nextStudentCode(): Promise<string> {
    const last = await this.prisma.student.findFirst({
      orderBy: { studentCode: 'desc' },
      select: { studentCode: true },
    });
    const lastNumber = last ? Number(last.studentCode.replace(/\D/g, '')) : 0;
    const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    return `STU-${String(next).padStart(6, '0')}`;
  }
}
