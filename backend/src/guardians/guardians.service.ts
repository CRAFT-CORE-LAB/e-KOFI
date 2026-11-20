import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PaymentIntentStatus, StudentStatus } from '../domain/enums';
import { PrismaService } from '../prisma/prisma.service';
import { mentionsSchool, mentionsStudent, nameCandidates, nameVariants } from '../whatsapp/match';
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

  async lookup(studentCode: string): Promise<Lookup> {
    const code = studentCode.trim().replace(/\s+/g, '').toUpperCase();
    const student = await this.prisma.student.findUnique({
      where: { studentCode: code },
      include: studentView,
    });
    if (!student) return { kind: 'missing' };
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

  /** Linked students, then students this number has already paid for (portal or WhatsApp). */
  async known(phone: string): Promise<PublicStudent[]> {
    const linked = await this.linked(phone);
    const seen = new Set(linked.map((student) => student.id));
    const paid = await this.prisma.paymentIntent.findMany({
      where: { phone: { in: phoneForms(phone) }, status: PaymentIntentStatus.POSTED },
      select: { studentId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const extraIds = [...new Set(paid.map((row) => row.studentId))].filter((id) => !seen.has(id));
    if (!extraIds.length) return linked;
    const students = await this.prisma.student.findMany({
      where: { id: { in: extraIds }, status: StudentStatus.ACTIVE },
      include: studentView,
    });
    const order = new Map(extraIds.map((id, index) => [id, index]));
    const extra = students
      .filter((student) => student.wallet)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((student) => this.present(student));
    return [...linked, ...extra].slice(0, 8);
  }

  async canSeeBalance(phone: string, studentId: string) {
    const guardian = await this.prisma.studentGuardian.findUnique({
      where: { studentId_phone: { studentId, phone } },
    });
    return Boolean(guardian);
  }

  /**
   * Students named in a message such as "send 5000 to Keza Uwase at Green Hills".
   * Both the first and the last name must be written. A student this number already
   * knows is found by name alone; anyone else also needs their school named, so a
   * name on its own never reveals which school a child attends.
   */
  async describe(phone: string, text: string): Promise<PublicStudent[]> {
    const candidates = nameCandidates(text);
    if (candidates.length < 2) return [];
    const known = (await this.known(phone)).filter((student) => {
      const [first, ...rest] = student.fullName.split(' ');
      return mentionsStudent(text, first ?? '', rest.join(' '));
    });
    if (known.length) return known;

    const schools = await this.prisma.school.findMany({ select: { id: true, name: true } });
    const named = schools.filter((school) => mentionsSchool(text, school.name));
    if (!named.length) return [];
    const variants = candidates.flatMap(nameVariants).slice(0, 90);
    const rows = await this.prisma.student.findMany({
      where: {
        schoolId: { in: named.map((school) => school.id) },
        status: StudentStatus.ACTIVE,
        OR: [{ firstName: { in: variants } }, { lastName: { in: variants } }],
      },
      include: studentView,
      take: 200,
    });
    return rows
      .filter((student) => student.wallet && mentionsStudent(text, student.firstName, student.lastName))
      .slice(0, 6)
      .map((student) => this.present(student));
  }

  /** True when the message names a school on e-KOFI. Used to pick up Shaka messages meant for e-KOFI. */
  async namesSchool(text: string) {
    if (nameCandidates(text).length < 1) return false;
    const schools = await this.prisma.school.findMany({ select: { name: true } });
    return schools.some((school) => mentionsSchool(text, school.name));
  }

  /** True when the message carries a student ID that exists. */
  async hasStudentCode(code: string) {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: code.trim().replace(/\s+/g, '').toUpperCase() },
      select: { id: true },
    });
    return Boolean(student);
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

/** A payment may have stored the number as 2507…, 07… or 7…. */
function phoneForms(phone: string) {
  const forms = new Set([phone]);
  if (/^2507\d{8}$/.test(phone)) {
    forms.add(`0${phone.slice(3)}`);
    forms.add(phone.slice(3));
    forms.add(`+${phone}`);
  }
  return [...forms];
}
