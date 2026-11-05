import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FinancialEventType, StudentStatus } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
  ) {}

  normalizeCode(raw: string) {
    return raw.trim().replace(/\s+/g, '').toUpperCase();
  }

  async openSession(studentCodeRaw: string) {
    const studentCode = this.normalizeCode(studentCodeRaw);
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: {
        wallet: true,
        school: true,
        class: true,
      },
    });
    if (!student?.wallet) {
      throw new NotFoundException('We could not find a student with that ID. Check the number and try again.');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('This student wallet is not active. Please contact the school.');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: student.id, code: student.studentCode, typ: 'parent' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '24h',
      },
    );

    return {
      accessToken,
      student: this.publicStudent(student),
      wallet: { balanceRwf: student.wallet.balanceRwf },
    };
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
      take: 40,
      include: { canteen: { select: { name: true } } },
    });

    return {
      student: this.publicStudent(wallet.student),
      balanceRwf: wallet.balanceRwf,
      activity: events.map((event) => ({
        id: event.id,
        type: event.type,
        label: this.activityLabel(event.type),
        amountRwf: this.creditedAmount(event.type, event.amountRwf, event.description),
        when: event.createdAt.toISOString(),
        canteenName: event.canteen?.name ?? null,
        description: event.description ?? null,
      })),
    };
  }

  topUp(studentId: string, amountRwf: number, mobilePhone: string, idempotencyKey?: string) {
    const key = idempotencyKey ?? `${Date.now()}-${studentId.slice(0, 8)}`;
    return this.payments.startParentTopUp(studentId, amountRwf, mobilePhone, key);
  }

  topUpStatus(studentId: string, requestId: string) {
    return this.payments.refresh(requestId, studentId);
  }

  private creditedAmount(type: FinancialEventType, amountRwf: number, description: string | null) {
    if (type !== FinancialEventType.PARENT_TOPUP || !description) return amountRwf;
    const match = description.match(/(\d+) to student/);
    return match ? Number(match[1]) : amountRwf;
  }

  private activityLabel(type: FinancialEventType) {
    switch (type) {
      case FinancialEventType.PARENT_TOPUP:
        return 'You added money';
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
