import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FinancialEventType, StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentPortalService {
  private readonly maxAttempts = 5;
  private readonly lockMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  normalizeCode(raw: string) {
    return raw.trim().replace(/\s+/g, '').toUpperCase();
  }

  async lookup(studentCodeRaw: string) {
    const studentCode = this.normalizeCode(studentCodeRaw);
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: { school: true, class: true, wallet: true },
    });
    if (!student?.wallet) {
      throw new NotFoundException('We could not find a student with that ID. Check the number and try again.');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('This wallet is not active. Please contact your school.');
    }

    return {
      studentCode: student.studentCode,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      schoolName: student.school.name,
      className: student.class.name,
      hasAccount: Boolean(student.portalPasswordHash),
    };
  }

  async register(studentCodeRaw: string, password: string) {
    const studentCode = this.normalizeCode(studentCodeRaw);
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: { wallet: true, school: true, class: true },
    });
    if (!student?.wallet) {
      throw new NotFoundException('We could not find a student with that ID.');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('This wallet is not active. Please contact your school.');
    }
    if (student.portalPasswordHash) {
      throw new ConflictException('An account already exists for this Student ID. Sign in instead.');
    }

    const portalPasswordHash = await bcrypt.hash(password, 12);
    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        portalPasswordHash,
        portalFailedCount: 0,
        portalLockedUntil: null,
      },
    });

    return this.issueSession(student);
  }

  async login(studentCodeRaw: string, password: string) {
    const studentCode = this.normalizeCode(studentCodeRaw);
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: { wallet: true, school: true, class: true },
    });
    if (!student?.wallet) {
      throw new NotFoundException('Wrong Student ID or password.');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('This wallet is not active. Please contact your school.');
    }
    if (!student.portalPasswordHash) {
      throw new BadRequestException('No account yet. Create one first with your Student ID.');
    }
    if (student.portalLockedUntil && student.portalLockedUntil > new Date()) {
      throw new BadRequestException(
        `Too many wrong passwords. Try again in about ${this.lockMinutes} minutes or ask your teacher for help.`,
      );
    }

    const ok = await bcrypt.compare(password, student.portalPasswordHash);
    if (!ok) {
      const failed = student.portalFailedCount + 1;
      const lock =
        failed >= this.maxAttempts ? new Date(Date.now() + this.lockMinutes * 60 * 1000) : null;
      await this.prisma.student.update({
        where: { id: student.id },
        data: { portalFailedCount: failed, portalLockedUntil: lock },
      });
      if (lock) {
        throw new UnauthorizedException(
          `Wrong password too many times. Wait ${this.lockMinutes} minutes, then try again.`,
        );
      }
      throw new UnauthorizedException(`Wrong password. ${this.maxAttempts - failed} tries left.`);
    }

    await this.prisma.student.update({
      where: { id: student.id },
      data: { portalFailedCount: 0, portalLockedUntil: null },
    });

    return this.issueSession(student);
  }

  async getWallet(studentId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { studentId },
      include: {
        student: { include: { school: true, class: true } },
      },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const events = await this.prisma.financialEvent.findMany({
      where: {
        walletId: wallet.id,
        status: 'POSTED',
        type: {
          in: [
            FinancialEventType.PARENT_TOPUP,
            FinancialEventType.TEST_CREDIT,
            FinancialEventType.PURCHASE,
            FinancialEventType.REVERSAL,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { canteen: { select: { name: true } } },
    });

    return {
      student: this.publicStudent(wallet.student),
      balanceRwf: wallet.balanceRwf,
      activity: events.map((event) => ({
        id: event.id,
        type: event.type,
        label: this.activityLabel(event.type),
        amountRwf:
          event.type === FinancialEventType.PARENT_TOPUP && event.description?.match(/(\d+) to student/)
            ? Number(event.description.match(/(\d+) to student/)?.[1])
            : event.amountRwf,
        when: event.createdAt.toISOString(),
        canteenName: event.canteen?.name ?? null,
        description: event.description ?? null,
      })),
    };
  }

  private async issueSession(student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    status: StudentStatus;
    wallet: { balanceRwf: number } | null;
    school: { name: string };
    class: { name: string };
  }) {
    const accessToken = await this.jwt.signAsync(
      { sub: student.id, code: student.studentCode, typ: 'student' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      student: this.publicStudent(student),
      wallet: { balanceRwf: student.wallet?.balanceRwf ?? 0 },
    };
  }

  private activityLabel(type: FinancialEventType) {
    switch (type) {
      case FinancialEventType.PARENT_TOPUP:
        return 'Money added (parent)';
      case FinancialEventType.TEST_CREDIT:
        return 'Money added at school';
      case FinancialEventType.PURCHASE:
        return 'Meal paid';
      case FinancialEventType.REVERSAL:
        return 'Money returned';
      default:
        return 'Wallet update';
    }
  }

  private publicStudent(student: {
    studentCode: string;
    firstName: string;
    lastName: string;
    status: StudentStatus;
    school: { name: string };
    class: { name: string };
  }) {
    return {
      studentCode: student.studentCode,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      schoolName: student.school.name,
      className: student.class.name,
      status: student.status,
    };
  }
}
