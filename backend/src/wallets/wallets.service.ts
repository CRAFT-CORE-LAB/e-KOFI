import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByStudent(studentId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { studentId },
      include: {
        student: { include: { school: true, class: true, cards: true } },
      },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    const history = await this.prisma.financialEvent.findMany({
      where: { walletId: wallet.id },
      include: { entries: true, canteen: true, createdBy: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { ...wallet, history };
  }
}
