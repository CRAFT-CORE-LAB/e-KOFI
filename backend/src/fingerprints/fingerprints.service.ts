import { Injectable, NotFoundException } from '@nestjs/common';
import { FingerPosition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollFingerprintDto } from './dto/enroll-fingerprint.dto';

const publicSelect = {
  id: true,
  studentId: true,
  finger: true,
  deviceModel: true,
  isActive: true,
  createdAt: true,
  student: {
    select: {
      id: true,
      studentCode: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class FingerprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(studentId?: string) {
    return this.prisma.fingerprintTemplate.findMany({
      where: {
        isActive: true,
        ...(studentId ? { studentId } : {}),
      },
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async templatesForSync() {
    const rows = await this.prisma.fingerprintTemplate.findMany({
      where: { isActive: true, student: { status: 'ACTIVE' } },
      select: { studentId: true, finger: true, template: true },
    });
    return rows.map((row) => ({
      userId: `${row.studentId}::${row.finger}`,
      template: row.template,
    }));
  }

  async enroll(dto: EnrollFingerprintDto) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const finger = dto.finger ?? FingerPosition.RIGHT_INDEX;
    const record = await this.prisma.fingerprintTemplate.upsert({
      where: { studentId_finger: { studentId: dto.studentId, finger } },
      update: {
        template: dto.template,
        deviceModel: dto.deviceModel ?? 'Live20R',
        isActive: true,
      },
      create: {
        studentId: dto.studentId,
        finger,
        template: dto.template,
        deviceModel: dto.deviceModel ?? 'Live20R',
      },
      select: publicSelect,
    });
    return record;
  }

  async remove(id: string) {
    const existing = await this.prisma.fingerprintTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Fingerprint not found');
    }
    return this.prisma.fingerprintTemplate.update({
      where: { id },
      data: { isActive: false },
      select: publicSelect,
    });
  }
}
