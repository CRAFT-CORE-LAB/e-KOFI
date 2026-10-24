import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialEventType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { IntouchService } from '../intouch/intouch.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCanteenDto } from './dto/create-canteen.dto';

@Injectable()
export class CanteensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intouch: IntouchService,
  ) {}

  list() {
    return this.prisma.canteen.findMany({
      include: { school: true, account: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const canteen = await this.prisma.canteen.findUnique({
      where: { id },
      include: { school: true, account: true },
    });
    if (!canteen) {
      throw new NotFoundException('Canteen not found');
    }
    const history = await this.prisma.financialEvent.findMany({
      where: { canteenId: id },
      include: {
        entries: true,
        student: { select: { studentCode: true, firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { ...canteen, history };
  }

  async create(dto: CreateCanteenDto) {
    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    try {
      return await this.prisma.canteen.create({
        data: {
          name: dto.name.trim(),
          schoolId: dto.schoolId,
          account: { create: { balanceRwf: 0 } },
        },
        include: { school: true, account: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A canteen with this name already exists at the school');
      }
      throw error;
    }
  }

  async withdraw(id: string, amountRwf: number, mobilePhone: string, actorId: string, idempotencyKey?: string) {
    if (!Number.isInteger(amountRwf) || amountRwf < 100) {
      throw new BadRequestException('Enter at least 100 RWF to withdraw.');
    }
    if (!this.intouch.configured()) {
      throw new BadRequestException(
        'Intouch Pay is not connected yet. Add the Intouch username, account number, and password on the server.',
      );
    }
    const key = idempotencyKey?.trim() || randomUUID();
    const duplicate = await this.prisma.financialEvent.findUnique({ where: { idempotencyKey: key } });
    if (duplicate) {
      return { ok: true, duplicate: true, message: 'This withdrawal was already sent.' };
    }

    const canteen = await this.prisma.canteen.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!canteen?.account) {
      throw new NotFoundException('Canteen not found');
    }

    const debit = await this.prisma.canteenAccount.updateMany({
      where: { id: canteen.account.id, balanceRwf: { gte: amountRwf } },
      data: { balanceRwf: { decrement: amountRwf } },
    });
    if (debit.count !== 1) {
      throw new BadRequestException('Canteen balance is not enough for this withdrawal.');
    }

    try {
      const payout = await this.intouch.sendPayout(
        amountRwf,
        mobilePhone,
        key,
        'e-KOFI canteen withdrawal',
      );
      const event = await this.prisma.financialEvent.create({
        data: {
          type: FinancialEventType.CANTEEN_WITHDRAWAL,
          amountRwf,
          description: `Intouch payout to ${payout.phone}`,
          idempotencyKey: key,
          canteenId: id,
          createdById: actorId,
          entries: {
            create: [
              {
                accountType: 'CANTEEN_ACCOUNT',
                side: 'DEBIT',
                amountRwf,
                canteenAccountId: canteen.account.id,
              },
              { accountType: 'INTOUCH_PAYOUT', side: 'CREDIT', amountRwf },
            ],
          },
        },
      });
      const account = await this.prisma.canteenAccount.findUniqueOrThrow({
        where: { id: canteen.account.id },
      });
      return { ok: true, event, account, phone: payout.phone, referenceId: payout.referenceId };
    } catch (error) {
      await this.prisma.canteenAccount.update({
        where: { id: canteen.account.id },
        data: { balanceRwf: { increment: amountRwf } },
      });
      throw error;
    }
  }
}
