import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const eventInclude = {
  entries: true,
  student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
  canteen: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  card: { select: { id: true, cardUid: true, status: true } },
} satisfies Prisma.FinancialEventInclude;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { studentId?: string; canteenId?: string; walletId?: string }) {
    const where: Prisma.FinancialEventWhereInput = {};
    if (params.studentId) where.studentId = params.studentId;
    if (params.canteenId) where.canteenId = params.canteenId;
    if (params.walletId) where.walletId = params.walletId;
    return this.prisma.financialEvent.findMany({
      where,
      include: eventInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  get(id: string) {
    return this.prisma.financialEvent.findUnique({
      where: { id },
      include: eventInclude,
    });
  }
}
