import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [students, activeStudents, canteens, cards, fingerprints, postedPurchases, purchaseAgg] =
      await Promise.all([
        this.prisma.student.count(),
        this.prisma.student.count({ where: { status: 'ACTIVE' } }),
        this.prisma.canteen.count(),
        this.prisma.nfcCard.count({ where: { status: 'ACTIVE' } }),
        this.prisma.fingerprintTemplate.count({ where: { isActive: true } }),
        this.prisma.financialEvent.count({
          where: { type: 'PURCHASE', status: 'POSTED' },
        }),
        this.prisma.financialEvent.aggregate({
          _sum: { amountRwf: true },
          where: { type: 'PURCHASE', status: 'POSTED' },
        }),
      ]);

    const recent = await this.prisma.financialEvent.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { studentCode: true, firstName: true, lastName: true } },
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
      recent,
    };
  }
}
