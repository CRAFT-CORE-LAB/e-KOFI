import {
  BadRequestException,
  ConflictException,
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
      studentId: true,
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
    const studentCode = await this.ensureUniqueCode(dto.studentCode);

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
      studentCode: dto.studentCode ? await this.ensureUniqueCode(dto.studentCode, id) : undefined,
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

  async remove(id: string) {
    const existing = await this.prisma.student.findUnique({
      where: { id },
      include: { wallet: true, _count: { select: { events: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    if (existing._count.events > 0) {
      return this.deactivate(id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.fingerprintTemplate.deleteMany({ where: { studentId: id } });
      await tx.nfcCard.deleteMany({ where: { studentId: id } });
      if (existing.wallet) {
        await tx.wallet.delete({ where: { id: existing.wallet.id } });
      }
      await tx.student.delete({ where: { id } });
    });

    return { id, studentCode: existing.studentCode, removed: true };
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

  private normalizeStudentCode(raw: string) {
    return raw.trim().replace(/\s+/g, '').toUpperCase();
  }

  private async ensureUniqueCode(raw: string, exceptId?: string) {
    const studentCode = this.normalizeStudentCode(raw);
    if (studentCode.length < 2) {
      throw new BadRequestException('Student ID is required');
    }
    const existing = await this.prisma.student.findUnique({ where: { studentCode } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('This student ID is already registered');
    }
    return studentCode;
  }
}
