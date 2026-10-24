import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const now = Date.now();
    const windows = {
      hours6: new Date(now - 6 * 60 * 60 * 1000),
      hours24: new Date(now - 24 * 60 * 60 * 1000),
      days7: new Date(now - 7 * 24 * 60 * 60 * 1000),
    };

    const purchaseWhere = { type: 'PURCHASE' as const, status: 'POSTED' as const };
    const period = (from: Date) =>
      Promise.all([
        this.prisma.financialEvent.count({ where: { ...purchaseWhere, createdAt: { gte: from } } }),
        this.prisma.financialEvent.aggregate({
          _sum: { amountRwf: true },
          where: { ...purchaseWhere, createdAt: { gte: from } },
        }),
      ]).then(([count, sum]) => ({ count, amountRwf: sum._sum.amountRwf ?? 0 }));

    const [students, activeStudents, canteens, cards, fingerprints, postedPurchases, purchaseAgg, hours6, hours24, days7, canteenBalance] =
      await Promise.all([
        this.prisma.student.count(),
        this.prisma.student.count({ where: { status: 'ACTIVE' } }),
        this.prisma.canteen.count(),
        this.prisma.nfcCard.count({ where: { status: 'ACTIVE' } }),
        this.prisma.fingerprintTemplate.count({ where: { isActive: true } }),
        this.prisma.financialEvent.count({ where: purchaseWhere }),
        this.prisma.financialEvent.aggregate({
          _sum: { amountRwf: true },
          where: purchaseWhere,
        }),
        period(windows.hours6),
        period(windows.hours24),
        period(windows.days7),
        this.prisma.canteenAccount.aggregate({ _sum: { balanceRwf: true } }),
      ]);

    const recent = await this.prisma.financialEvent.findMany({
      take: 20,
      where: { type: { in: ['PURCHASE', 'CANTEEN_WITHDRAWAL'] }, status: 'POSTED' },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
        canteen: { select: { name: true } },
      },
    });

    return {
      students,
      activeStudents,
      canteens,
      activeCards: cards,
      enrolledFingerprints: fingerprints,
      postedPurchases,
      purchaseVolumeRwf: purchaseAgg._sum.amountRwf ?? 0,
      canteenBalanceRwf: canteenBalance._sum.balanceRwf ?? 0,
      periods: { hours6, hours24, days7 },
      recent,
    };
  }
}
