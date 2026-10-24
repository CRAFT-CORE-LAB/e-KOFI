import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CardStatus,
  FinancialEventStatus,
  FinancialEventType,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { CardsService } from '../cards/cards.service';
import { PrismaService } from '../prisma/prisma.service';

export type PurchaseInput = {
  amountRwf: number;
  canteenId: string;
  studentId?: string;
  cardUid?: string;
  authToken?: string;
  pin?: string;
  description?: string;
  identifiedBy?: string;
  idempotencyKey: string;
  actorId: string;
};

export type TestCreditInput = {
  studentId: string;
  amountRwf: number;
  description?: string;
  idempotencyKey: string;
  actorId: string;
};

export type ReverseInput = {
  eventId: string;
  idempotencyKey: string;
  actorId: string;
  description?: string;
};

@Injectable()
export class FinanceService {
  private readonly pinMaxAttempts: number;
  private readonly pinLockMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    config: ConfigService,
  ) {
    this.pinMaxAttempts = Number(config.get('PIN_MAX_ATTEMPTS') ?? 5);
    this.pinLockMinutes = Number(config.get('PIN_LOCK_MINUTES') ?? 15);
  }

  async testCredit(input: TestCreditInput) {
    this.assertPositiveAmount(input.amountRwf);
    return this.withIdempotency(input.idempotencyKey, async () => {
      return this.prisma.$transaction(async (tx) => {
        const duplicate = await this.findDuplicate(tx, input.idempotencyKey);
        if (duplicate) return duplicate;

        const student = await tx.student.findUnique({
          where: { id: input.studentId },
          include: { wallet: true },
        });
        if (!student?.wallet) {
          throw new NotFoundException('Student wallet not found');
        }
        if (student.status !== StudentStatus.ACTIVE) {
          throw new BadRequestException('Cannot credit a deactivated student');
        }

        await tx.wallet.update({
          where: { id: student.wallet.id },
          data: { balanceRwf: { increment: input.amountRwf } },
        });

        const event = await tx.financialEvent.create({
          data: {
            type: FinancialEventType.TEST_CREDIT,
            amountRwf: input.amountRwf,
            description: input.description ?? 'Administrator test credit (development only)',
            idempotencyKey: input.idempotencyKey,
            studentId: student.id,
            walletId: student.wallet.id,
            createdById: input.actorId,
            entries: {
              create: [
                {
                  accountType: 'SYSTEM_TEST_FUND',
                  side: 'DEBIT',
                  amountRwf: input.amountRwf,
                },
                {
                  accountType: 'STUDENT_WALLET',
                  side: 'CREDIT',
                  amountRwf: input.amountRwf,
                  walletId: student.wallet.id,
                },
              ],
            },
          },
          include: { entries: true, student: true, wallet: true },
        });

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: student.wallet.id } });
        return { event, wallet };
      });
    });
  }

  async purchase(input: PurchaseInput) {
    this.assertPositiveAmount(input.amountRwf);
    if (!input.studentId && !(input.cardUid && input.authToken)) {
      throw new BadRequestException('Identify the student with a fingerprint first');
    }

    return this.withIdempotency(input.idempotencyKey, async () => {
      let cardId: string | undefined;
      let studentId = input.studentId;

      if (input.cardUid && input.authToken) {
        const card = await this.cards.authenticateCard(input.cardUid, input.authToken);
        cardId = card.id;
        if (studentId && studentId !== card.studentId) {
          throw new BadRequestException('Card is not assigned to the selected student');
        }
        studentId = card.studentId;
      }

      if (!studentId) {
        throw new BadRequestException('Student could not be resolved');
      }

      return this.prisma.$transaction(
        async (tx) => {
          const duplicate = await this.findDuplicate(tx, input.idempotencyKey);
          if (duplicate) return duplicate;

          const student = await tx.student.findUnique({
            where: { id: studentId },
            include: { wallet: true, cards: true },
          });
          if (!student?.wallet) {
            throw new NotFoundException('Student wallet not found');
          }
          if (student.status !== StudentStatus.ACTIVE) {
            throw new BadRequestException('Student account is deactivated');
          }

          if (cardId) {
            const card = student.cards.find((item) => item.id === cardId);
            if (!card || card.status !== CardStatus.ACTIVE) {
              throw new BadRequestException('Card is invalid or blocked');
            }
          }

          const canteen = await tx.canteen.findUnique({
            where: { id: input.canteenId },
            include: { account: true },
          });
          if (!canteen?.account) {
            throw new NotFoundException('Canteen account not found');
          }
          if (!canteen.isActive) {
            throw new BadRequestException('Canteen is inactive');
          }

          const debit = await tx.wallet.updateMany({
            where: { id: student.wallet.id, balanceRwf: { gte: input.amountRwf } },
            data: { balanceRwf: { decrement: input.amountRwf } },
          });
          if (debit.count !== 1) {
            throw new BadRequestException('Insufficient wallet balance');
          }

          await tx.canteenAccount.update({
            where: { id: canteen.account.id },
            data: { balanceRwf: { increment: input.amountRwf } },
          });

          const event = await tx.financialEvent.create({
            data: {
              type: FinancialEventType.PURCHASE,
              amountRwf: input.amountRwf,
              description: input.description ?? 'Canteen meal',
              idempotencyKey: input.idempotencyKey,
              studentId: student.id,
              walletId: student.wallet.id,
              canteenId: canteen.id,
              cardId,
              createdById: input.actorId,
              entries: {
                create: [
                  {
                    accountType: 'STUDENT_WALLET',
                    side: 'DEBIT',
                    amountRwf: input.amountRwf,
                    walletId: student.wallet.id,
                  },
                  {
                    accountType: 'CANTEEN_ACCOUNT',
                    side: 'CREDIT',
                    amountRwf: input.amountRwf,
                    canteenAccountId: canteen.account.id,
                  },
                ],
              },
            },
            include: { entries: true, student: true, canteen: true, wallet: true },
          });

          const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: student.wallet.id } });
          const canteenAccount = await tx.canteenAccount.findUniqueOrThrow({
            where: { id: canteen.account.id },
          });
          this.assertBalanced(event.entries);
          return { event, wallet, canteenAccount };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }

  async reverse(input: ReverseInput) {
    return this.withIdempotency(input.idempotencyKey, async () => {
      return this.prisma.$transaction(async (tx) => {
        const duplicate = await this.findDuplicate(tx, input.idempotencyKey);
        if (duplicate) return duplicate;

        const original = await tx.financialEvent.findUnique({
          where: { id: input.eventId },
          include: { entries: true, reversedBy: true, wallet: true },
        });
        if (!original) {
          throw new NotFoundException('Transaction not found');
        }
        if (original.status === FinancialEventStatus.REVERSED || original.reversedBy) {
          throw new ConflictException('Transaction already reversed');
        }
        if (original.type === FinancialEventType.REVERSAL) {
          throw new BadRequestException('Cannot reverse a reversal');
        }

        if (original.type === FinancialEventType.PURCHASE) {
          if (!original.walletId || !original.canteenId) {
            throw new BadRequestException('Purchase is missing accounts');
          }
          const canteen = await tx.canteen.findUnique({
            where: { id: original.canteenId },
            include: { account: true },
          });
          if (!canteen?.account) {
            throw new NotFoundException('Canteen account not found');
          }
          const canteenDebit = await tx.canteenAccount.updateMany({
            where: { id: canteen.account.id, balanceRwf: { gte: original.amountRwf } },
            data: { balanceRwf: { decrement: original.amountRwf } },
          });
          if (canteenDebit.count !== 1) {
            throw new BadRequestException('Canteen balance is insufficient to reverse this purchase');
          }
          await tx.wallet.update({
            where: { id: original.walletId },
            data: { balanceRwf: { increment: original.amountRwf } },
          });
        } else if (original.type === FinancialEventType.TEST_CREDIT) {
          if (!original.walletId) {
            throw new BadRequestException('Credit is missing a wallet');
          }
          const walletDebit = await tx.wallet.updateMany({
            where: { id: original.walletId, balanceRwf: { gte: original.amountRwf } },
            data: { balanceRwf: { decrement: original.amountRwf } },
          });
          if (walletDebit.count !== 1) {
            throw new BadRequestException('Wallet balance is insufficient to reverse this credit');
          }
        }

        const reversalEntries = original.entries.map((entry) => ({
          accountType: entry.accountType,
          side: entry.side === 'DEBIT' ? ('CREDIT' as const) : ('DEBIT' as const),
          amountRwf: entry.amountRwf,
          walletId: entry.walletId,
          canteenAccountId: entry.canteenAccountId,
        }));

        const event = await tx.financialEvent.create({
          data: {
            type: FinancialEventType.REVERSAL,
            amountRwf: original.amountRwf,
            description: input.description ?? `Reversal of ${original.id}`,
            idempotencyKey: input.idempotencyKey,
            studentId: original.studentId,
            walletId: original.walletId,
            canteenId: original.canteenId,
            cardId: original.cardId,
            createdById: input.actorId,
            reversesEventId: original.id,
            entries: { create: reversalEntries },
          },
          include: { entries: true },
        });

        await tx.financialEvent.update({
          where: { id: original.id },
          data: { status: FinancialEventStatus.REVERSED },
        });

        return { event, reversedEventId: original.id };
      });
    });
  }

  private async verifyPinIfRequired(studentId: string, pin?: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (!student.pinEnabled) {
      return;
    }
    if (student.pinLockedUntil && student.pinLockedUntil > new Date()) {
      throw new BadRequestException('PIN is locked after too many failed attempts');
    }
    if (!pin) {
      throw new BadRequestException('PIN authorization is required for this student');
    }
    if (!student.pinHash) {
      throw new BadRequestException('PIN is enabled but not configured');
    }
    const ok = await bcrypt.compare(pin, student.pinHash);
    if (!ok) {
      const failed = student.pinFailedCount + 1;
      const lock =
        failed >= this.pinMaxAttempts
          ? new Date(Date.now() + this.pinLockMinutes * 60 * 1000)
          : null;
      await this.prisma.student.update({
        where: { id: studentId },
        data: {
          pinFailedCount: failed,
          pinLockedUntil: lock,
        },
      });
      throw new BadRequestException(
        lock
          ? `Invalid PIN. Account locked for ${this.pinLockMinutes} minutes`
          : `Invalid PIN. ${this.pinMaxAttempts - failed} attempts remaining`,
      );
    }
    await this.prisma.student.update({
      where: { id: studentId },
      data: { pinFailedCount: 0, pinLockedUntil: null },
    });
  }

  private assertPositiveAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer RWF value');
    }
  }

  private assertBalanced(entries: { side: string; amountRwf: number }[]) {
    const debit = entries.filter((e) => e.side === 'DEBIT').reduce((s, e) => s + e.amountRwf, 0);
    const credit = entries.filter((e) => e.side === 'CREDIT').reduce((s, e) => s + e.amountRwf, 0);
    if (debit !== credit) {
      throw new ConflictException('Ledger entries are not balanced');
    }
  }

  private async findDuplicate(tx: Prisma.TransactionClient, key: string) {
    const existing = await tx.financialEvent.findUnique({
      where: { idempotencyKey: key },
      include: { entries: true, student: true, canteen: true, wallet: true },
    });
    if (!existing) {
      return null;
    }
    return { event: existing, duplicate: true as const };
  }

  private async withIdempotency<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (existing) {
      return existing.body as T;
    }
    try {
      const result = await work();
      const body = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
      await this.prisma.idempotencyRecord.upsert({
        where: { key },
        update: {},
        create: { key, statusCode: 201, body },
      });
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
        if (replay) {
          return replay.body as T;
        }
        const event = await this.prisma.financialEvent.findUnique({
          where: { idempotencyKey: key },
          include: { entries: true, student: true, canteen: true, wallet: true },
        });
        if (event) {
          return { event, duplicate: true } as T;
        }
        throw new ConflictException('Duplicate request');
      }
      throw error;
    }
  }

  newIdempotencyKey() {
    return randomUUID();
  }
}
