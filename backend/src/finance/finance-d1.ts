import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FinancialEventStatus,
  FinancialEventType,
  LedgerAccountType,
  LedgerEntrySide,
  StudentStatus,
} from '../domain/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkedUpdate,
  checkedUpdateAgain,
  clearGuard,
  isUniqueError,
  runBatch,
} from '../prisma/d1-batch';
import type { ParentTopUpInput, PurchaseInput, ReverseInput, TestCreditInput } from './finance.service';

const eventInclude = {
  entries: true,
  student: true,
  canteen: true,
  wallet: true,
} as const;

function now(): string {
  return new Date().toISOString();
}

function insertEvent(row: {
  id: string;
  type: string;
  amountRwf: number;
  description: string | null;
  idempotencyKey: string;
  studentId: string | null;
  walletId: string | null;
  canteenId: string | null;
  cardId: string | null;
  createdById: string;
  reversesEventId: string | null;
  createdAt: string;
}): [string, ...unknown[]] {
  return [
    `INSERT INTO "FinancialEvent" (
      "id", "type", "status", "amountRwf", "description", "idempotencyKey",
      "studentId", "walletId", "canteenId", "cardId", "createdById", "reversesEventId", "createdAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.type,
    FinancialEventStatus.POSTED,
    row.amountRwf,
    row.description,
    row.idempotencyKey,
    row.studentId,
    row.walletId,
    row.canteenId,
    row.cardId,
    row.createdById,
    row.reversesEventId,
    row.createdAt,
  ];
}

function insertEntry(row: {
  eventId: string;
  accountType: string;
  side: string;
  amountRwf: number;
  walletId?: string | null;
  canteenAccountId?: string | null;
  platformFeeAccountId?: string | null;
  createdAt: string;
}): [string, ...unknown[]] {
  return [
    `INSERT INTO "LedgerEntry" (
      "id", "eventId", "accountType", "side", "amountRwf",
      "walletId", "canteenAccountId", "platformFeeAccountId", "createdAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    row.eventId,
    row.accountType,
    row.side,
    row.amountRwf,
    row.walletId ?? null,
    row.canteenAccountId ?? null,
    row.platformFeeAccountId ?? null,
    row.createdAt,
  ];
}

async function existingEvent(prisma: PrismaService, idempotencyKey: string) {
  return prisma.financialEvent.findUnique({
    where: { idempotencyKey },
    include: eventInclude,
  });
}

export async function d1ParentTopUp(prisma: PrismaService, input: ParentTopUpInput) {
  const duplicate = await existingEvent(prisma, input.idempotencyKey);
  if (duplicate) return { event: duplicate, duplicate: true as const };

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { wallet: true },
  });
  if (!student?.wallet) throw new NotFoundException('Student wallet not found');
  if (student.status !== StudentStatus.ACTIVE) {
    throw new BadRequestException('Cannot add money to this wallet right now');
  }
  const feeAccount = await prisma.platformFeeAccount.findFirst();
  if (!feeAccount) throw new BadRequestException('Platform fee account is not ready.');

  const createdAt = now();
  const eventId = randomUUID();
  const statements = [
    ...checkedUpdate(
      `UPDATE "Wallet" SET "balanceRwf" = "balanceRwf" + ?, "updatedAt" = ? WHERE "id" = ?`,
      input.studentCreditRwf,
      createdAt,
      student.wallet.id,
    ),
  ];
  if (input.feeRwf > 0) {
    statements.push(
      ...checkedUpdateAgain(
        `UPDATE "PlatformFeeAccount" SET "balanceRwf" = "balanceRwf" + ?, "updatedAt" = ? WHERE "id" = ?`,
        input.feeRwf,
        createdAt,
        feeAccount.id,
      ),
    );
  }
  statements.push(
    clearGuard(),
    insertEvent({
      id: eventId,
      type: FinancialEventType.PARENT_TOPUP,
      amountRwf: input.grossRwf,
      description:
        input.description ??
        `Parent paid ${input.grossRwf} RWF · ${input.studentCreditRwf} to student · ${input.feeRwf} service fee`,
      idempotencyKey: input.idempotencyKey,
      studentId: student.id,
      walletId: student.wallet.id,
      canteenId: null,
      cardId: null,
      createdById: input.actorId,
      reversesEventId: null,
      createdAt,
    }),
    insertEntry({
      eventId,
      accountType: LedgerAccountType.INTOUCH_PAYOUT,
      side: LedgerEntrySide.DEBIT,
      amountRwf: input.grossRwf,
      createdAt,
    }),
    insertEntry({
      eventId,
      accountType: LedgerAccountType.STUDENT_WALLET,
      side: LedgerEntrySide.CREDIT,
      amountRwf: input.studentCreditRwf,
      walletId: student.wallet.id,
      createdAt,
    }),
  );
  if (input.feeRwf > 0) {
    statements.push(
      insertEntry({
        eventId,
        accountType: LedgerAccountType.PLATFORM_FEE,
        side: LedgerEntrySide.CREDIT,
        amountRwf: input.feeRwf,
        platformFeeAccountId: feeAccount.id,
        createdAt,
      }),
    );
  }

  try {
    await runBatch(statements, 'Could not credit this wallet');
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const event = await existingEvent(prisma, input.idempotencyKey);
    if (event) return { event, duplicate: true as const };
    throw error;
  }

  const event = await prisma.financialEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { entries: true, student: true, wallet: true },
  });
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: student.wallet.id } });
  return { event, wallet, feeRwf: input.feeRwf, studentCreditRwf: input.studentCreditRwf };
}

export async function d1TestCredit(prisma: PrismaService, input: TestCreditInput) {
  const duplicate = await existingEvent(prisma, input.idempotencyKey);
  if (duplicate) return { event: duplicate, duplicate: true as const };

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { wallet: true },
  });
  if (!student?.wallet) throw new NotFoundException('Student wallet not found');
  if (student.status !== StudentStatus.ACTIVE) {
    throw new BadRequestException('Cannot credit a deactivated student');
  }

  const createdAt = now();
  const eventId = randomUUID();
  try {
    await runBatch(
      [
        ...checkedUpdate(
          `UPDATE "Wallet" SET "balanceRwf" = "balanceRwf" + ?, "updatedAt" = ? WHERE "id" = ?`,
          input.amountRwf,
          createdAt,
          student.wallet.id,
        ),
        clearGuard(),
        insertEvent({
          id: eventId,
          type: FinancialEventType.TEST_CREDIT,
          amountRwf: input.amountRwf,
          description: input.description ?? 'Administrator test credit (development only)',
          idempotencyKey: input.idempotencyKey,
          studentId: student.id,
          walletId: student.wallet.id,
          canteenId: null,
          cardId: null,
          createdById: input.actorId,
          reversesEventId: null,
          createdAt,
        }),
        insertEntry({
          eventId,
          accountType: LedgerAccountType.SYSTEM_TEST_FUND,
          side: LedgerEntrySide.DEBIT,
          amountRwf: input.amountRwf,
          createdAt,
        }),
        insertEntry({
          eventId,
          accountType: LedgerAccountType.STUDENT_WALLET,
          side: LedgerEntrySide.CREDIT,
          amountRwf: input.amountRwf,
          walletId: student.wallet.id,
          createdAt,
        }),
      ],
      'Could not credit this wallet',
    );
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const event = await existingEvent(prisma, input.idempotencyKey);
    if (event) return { event, duplicate: true as const };
    throw error;
  }

  const event = await prisma.financialEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { entries: true, student: true, wallet: true },
  });
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: student.wallet.id } });
  return { event, wallet };
}

export async function d1Purchase(prisma: PrismaService, input: PurchaseInput) {
  const duplicate = await existingEvent(prisma, input.idempotencyKey);
  if (duplicate) return { event: duplicate, duplicate: true as const };

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { wallet: true },
  });
  if (!student?.wallet) throw new NotFoundException('Student wallet not found');
  if (student.status !== StudentStatus.ACTIVE) {
    throw new BadRequestException('Student account is deactivated');
  }
  const canteen = await prisma.canteen.findUnique({
    where: { id: input.canteenId },
    include: { account: true },
  });
  if (!canteen?.account) throw new NotFoundException('Canteen account not found');
  if (!canteen.isActive) throw new BadRequestException('Canteen is inactive');

  const createdAt = now();
  const eventId = randomUUID();
  const entries = [
    {
      accountType: LedgerAccountType.STUDENT_WALLET,
      side: LedgerEntrySide.DEBIT,
      amountRwf: input.amountRwf,
    },
    {
      accountType: LedgerAccountType.CANTEEN_ACCOUNT,
      side: LedgerEntrySide.CREDIT,
      amountRwf: input.amountRwf,
    },
  ];
  const debit = entries.filter((e) => e.side === LedgerEntrySide.DEBIT).reduce((s, e) => s + e.amountRwf, 0);
  const credit = entries.filter((e) => e.side === LedgerEntrySide.CREDIT).reduce((s, e) => s + e.amountRwf, 0);
  if (debit !== credit) throw new ConflictException('Ledger entries are not balanced');

  try {
    await runBatch(
      [
        ...checkedUpdate(
          `UPDATE "Wallet" SET "balanceRwf" = "balanceRwf" - ?, "updatedAt" = ? WHERE "id" = ? AND "balanceRwf" >= ?`,
          input.amountRwf,
          createdAt,
          student.wallet.id,
          input.amountRwf,
        ),
        ...checkedUpdateAgain(
          `UPDATE "CanteenAccount" SET "balanceRwf" = "balanceRwf" + ?, "updatedAt" = ? WHERE "id" = ?`,
          input.amountRwf,
          createdAt,
          canteen.account.id,
        ),
        clearGuard(),
        insertEvent({
          id: eventId,
          type: FinancialEventType.PURCHASE,
          amountRwf: input.amountRwf,
          description: input.description ?? 'Canteen meal',
          idempotencyKey: input.idempotencyKey,
          studentId: student.id,
          walletId: student.wallet.id,
          canteenId: canteen.id,
          cardId: null,
          createdById: input.actorId,
          reversesEventId: null,
          createdAt,
        }),
        insertEntry({
          eventId,
          accountType: LedgerAccountType.STUDENT_WALLET,
          side: LedgerEntrySide.DEBIT,
          amountRwf: input.amountRwf,
          walletId: student.wallet.id,
          createdAt,
        }),
        insertEntry({
          eventId,
          accountType: LedgerAccountType.CANTEEN_ACCOUNT,
          side: LedgerEntrySide.CREDIT,
          amountRwf: input.amountRwf,
          canteenAccountId: canteen.account.id,
          createdAt,
        }),
      ],
      'Insufficient wallet balance',
    );
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const event = await existingEvent(prisma, input.idempotencyKey);
    if (event) return { event, duplicate: true as const };
    throw error;
  }

  const event = await prisma.financialEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { entries: true, student: true, canteen: true, wallet: true },
  });
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: student.wallet.id } });
  const canteenAccount = await prisma.canteenAccount.findUniqueOrThrow({ where: { id: canteen.account.id } });
  return { event, wallet, canteenAccount };
}

export async function d1Reverse(prisma: PrismaService, input: ReverseInput) {
  const duplicate = await existingEvent(prisma, input.idempotencyKey);
  if (duplicate) return { event: duplicate, duplicate: true as const };

  const original = await prisma.financialEvent.findUnique({
    where: { id: input.eventId },
    include: { entries: true, reversedBy: true, wallet: true },
  });
  if (!original) throw new NotFoundException('Transaction not found');
  if (original.status === FinancialEventStatus.REVERSED || original.reversedBy) {
    throw new ConflictException('Transaction already reversed');
  }
  if (original.type === FinancialEventType.REVERSAL) {
    throw new BadRequestException('Cannot reverse a reversal');
  }

  const createdAt = now();
  const eventId = randomUUID();
  const statements: [string, ...unknown[]][] = [];

  if (original.type === FinancialEventType.PURCHASE) {
    if (!original.walletId || !original.canteenId) {
      throw new BadRequestException('Purchase is missing accounts');
    }
    const canteen = await prisma.canteen.findUnique({
      where: { id: original.canteenId },
      include: { account: true },
    });
    if (!canteen?.account) throw new NotFoundException('Canteen account not found');
    statements.push(
      ...checkedUpdate(
        `UPDATE "CanteenAccount" SET "balanceRwf" = "balanceRwf" - ?, "updatedAt" = ? WHERE "id" = ? AND "balanceRwf" >= ?`,
        original.amountRwf,
        createdAt,
        canteen.account.id,
        original.amountRwf,
      ),
      ...checkedUpdateAgain(
        `UPDATE "Wallet" SET "balanceRwf" = "balanceRwf" + ?, "updatedAt" = ? WHERE "id" = ?`,
        original.amountRwf,
        createdAt,
        original.walletId,
      ),
    );
  } else if (original.type === FinancialEventType.TEST_CREDIT) {
    if (!original.walletId) throw new BadRequestException('Credit is missing a wallet');
    statements.push(
      ...checkedUpdate(
        `UPDATE "Wallet" SET "balanceRwf" = "balanceRwf" - ?, "updatedAt" = ? WHERE "id" = ? AND "balanceRwf" >= ?`,
        original.amountRwf,
        createdAt,
        original.walletId,
        original.amountRwf,
      ),
    );
  }

  if (statements.length) statements.push(clearGuard());
  statements.push(
    insertEvent({
      id: eventId,
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
      createdAt,
    }),
  );
  for (const entry of original.entries) {
    statements.push(
      insertEntry({
        eventId,
        accountType: entry.accountType,
        side: entry.side === LedgerEntrySide.DEBIT ? LedgerEntrySide.CREDIT : LedgerEntrySide.DEBIT,
        amountRwf: entry.amountRwf,
        walletId: entry.walletId,
        canteenAccountId: entry.canteenAccountId,
        createdAt,
      }),
    );
  }
  statements.push(
    ...checkedUpdate(
      `UPDATE "FinancialEvent" SET "status" = ? WHERE "id" = ? AND "status" = ?`,
      FinancialEventStatus.REVERSED,
      original.id,
      FinancialEventStatus.POSTED,
    ),
    clearGuard(),
  );

  try {
    await runBatch(
      statements,
      original.type === FinancialEventType.PURCHASE
        ? 'Canteen balance is insufficient to reverse this purchase'
        : 'Wallet balance is insufficient to reverse this credit',
    );
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const event = await existingEvent(prisma, input.idempotencyKey);
    if (event) return { event, duplicate: true as const };
    throw error;
  }

  const event = await prisma.financialEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { entries: true },
  });
  return { event, reversedEventId: original.id };
}
