import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { StudentStatus } from '../domain/enums';
import { PrismaService } from '../prisma/prisma.service';
import { canonicalPhone } from '../whatsapp/phone';
import type { LinkResult, Lookup } from '../whatsapp/engine';
import type { PublicStudent } from '../whatsapp/states';

const studentView = {
  school: true,
  class: true,
  wallet: true,
} satisfies Prisma.StudentInclude;

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(studentId: string) {
    await this.requireStudent(studentId);
    const rows = await this.prisma.studentGuardian.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async link(studentId: string, rawPhone: string, label?: string) {
    await this.requireStudent(studentId);
    const phone = this.requirePhone(rawPhone);
    try {
      const row = await this.prisma.studentGuardian.create({
        data: { studentId, phone, label: label?.trim() || null },
      });
      return { id: row.id, phone: row.phone, label: row.label, createdAt: row.createdAt.toISOString() };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That WhatsApp number is already linked to this student.');
      }
      throw error;
    }
  }

  async unlink(studentId: string, guardianId: string) {
    const removed = await this.prisma.studentGuardian.deleteMany({
      where: { id: guardianId, studentId },
    });
    if (removed.count !== 1) {
      throw new NotFoundException('Linked phone not found');
    }
    return { id: guardianId, removed: true };
  }

  async issueCode(studentId: string) {
    await this.requireStudent(studentId);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.guardianLinkCode.updateMany({
      where: { studentId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.guardianLinkCode.create({
      data: { studentId, codeHash: this.hash(code), expiresAt },
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async lookup(phone: string, studentCode: string): Promise<Lookup> {
    const code = studentCode.trim().replace(/\s+/g, '').toUpperCase();
    const student = await this.prisma.student.findUnique({
      where: { studentCode: code },
      include: studentView,
    });
    if (!student) return { kind: 'missing' };
    const guardian = await this.prisma.studentGuardian.findUnique({
      where: { studentId_phone: { studentId: student.id, phone } },
    });
    if (!guardian) return { kind: 'unauthorized', studentId: student.id };
    if (student.status !== StudentStatus.ACTIVE) return { kind: 'inactive' };
    if (!student.wallet) return { kind: 'no_wallet' };
    return { kind: 'ok', student: this.present(student) };
  }

  async linked(phone: string): Promise<PublicStudent[]> {
    const rows = await this.prisma.studentGuardian.findMany({
      where: { phone },
      include: { student: { include: studentView } },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((row) => row.student.status === StudentStatus.ACTIVE && row.student.wallet)
      .map((row) => this.present(row.student));
  }

  async redeem(phone: string, studentId: string, code: string): Promise<LinkResult> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: studentView,
    });
    if (!student) return { ok: false, reason: 'invalid' };
    const rows = await this.prisma.guardianLinkCode.findMany({
      where: { studentId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const hash = this.hash(code);
    const match = rows.find((row) => this.sameHash(row.codeHash, hash));
    if (!match) return { ok: false, reason: 'invalid' };
    if (match.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };
    if (student.status !== StudentStatus.ACTIVE) return { ok: false, reason: 'inactive' };
    if (!student.wallet) return { ok: false, reason: 'no_wallet' };
    const consumed = await this.prisma.guardianLinkCode.updateMany({
      where: { id: match.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) return { ok: false, reason: 'invalid' };
    await this.prisma.studentGuardian.upsert({
      where: { studentId_phone: { studentId, phone } },
      update: {},
      create: { studentId, phone },
    });
    return { ok: true, student: this.present(student) };
  }

  async balance(studentId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { studentId } });
    return wallet ? wallet.balanceRwf : null;
  }

  private async requireStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private requirePhone(raw: string) {
    const phone = canonicalPhone(raw);
    if (!/^\d{9,15}$/.test(phone)) {
      throw new BadRequestException('Enter the parent WhatsApp number with the country code.');
    }
    return phone;
  }

  private hash(code: string) {
    const pepper = this.config.get<string>('CARD_TOKEN_PEPPER') || this.config.getOrThrow<string>('JWT_SECRET');
    return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
  }

  private sameHash(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private present(student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    schoolId: string;
    school: { name: string };
    class: { name: string };
  }): PublicStudent {
    return {
      id: student.id,
      studentCode: student.studentCode,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      className: student.class.name,
      schoolName: student.school.name,
      schoolId: student.schoolId,
    };
  }
}
