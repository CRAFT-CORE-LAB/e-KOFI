import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus, StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CardsService } from '../cards/cards.service';
import { FinanceService } from './finance.service';

type Wallet = { id: string; studentId: string; balanceRwf: number };
type CanteenAccount = { id: string; canteenId: string; balanceRwf: number };
type Student = {
  id: string;
  status: StudentStatus;
  pinEnabled: boolean;
  pinHash: string | null;
  pinFailedCount: number;
  pinLockedUntil: Date | null;
  wallet: Wallet;
  cards: Array<{ id: string; status: CardStatus; studentId: string }>;
};

function createDb() {
  const students = new Map<string, Student>();
  const wallets = new Map<string, Wallet>();
  const canteens = new Map<string, { id: string; isActive: boolean; account: CanteenAccount }>();
  const events = new Map<string, any>();
  const eventsByKey = new Map<string, any>();
  const entries: any[] = [];
  const idempotency = new Map<string, any>();

  const tx = {
    student: {
      findUnique: async ({ where }: any) => students.get(where.id) ?? null,
    },
    wallet: {
      findUniqueOrThrow: async ({ where }: any) => {
        const wallet = [...wallets.values()].find((item) => item.id === where.id);
        if (!wallet) throw new Error('wallet missing');
        return { ...wallet };
      },
      update: async ({ where, data }: any) => {
        const wallet = [...wallets.values()].find((item) => item.id === where.id)!;
        if (data.balanceRwf?.increment) wallet.balanceRwf += data.balanceRwf.increment;
        if (data.balanceRwf?.decrement) wallet.balanceRwf -= data.balanceRwf.decrement;
        return { ...wallet };
      },
      updateMany: async ({ where, data }: any) => {
        const wallet = [...wallets.values()].find((item) => item.id === where.id);
        if (!wallet) return { count: 0 };
        if (where.balanceRwf?.gte !== undefined && wallet.balanceRwf < where.balanceRwf.gte) {
          return { count: 0 };
        }
        if (data.balanceRwf?.decrement) wallet.balanceRwf -= data.balanceRwf.decrement;
        if (data.balanceRwf?.increment) wallet.balanceRwf += data.balanceRwf.increment;
        if (wallet.balanceRwf < 0) {
          wallet.balanceRwf += data.balanceRwf.decrement ?? 0;
          return { count: 0 };
        }
        return { count: 1 };
      },
    },
    canteen: {
      findUnique: async ({ where }: any) => canteens.get(where.id) ?? null,
    },
    canteenAccount: {
      findUniqueOrThrow: async ({ where }: any) => {
        const account = [...canteens.values()].find((c) => c.account.id === where.id)?.account;
        if (!account) throw new Error('account missing');
        return { ...account };
      },
      update: async ({ where, data }: any) => {
        const account = [...canteens.values()].find((c) => c.account.id === where.id)!.account;
        if (data.balanceRwf?.increment) account.balanceRwf += data.balanceRwf.increment;
        if (data.balanceRwf?.decrement) account.balanceRwf -= data.balanceRwf.decrement;
        return { ...account };
      },
      updateMany: async ({ where, data }: any) => {
        const account = [...canteens.values()].find((c) => c.account.id === where.id)?.account;
        if (!account) return { count: 0 };
        if (where.balanceRwf?.gte !== undefined && account.balanceRwf < where.balanceRwf.gte) {
          return { count: 0 };
        }
        if (data.balanceRwf?.decrement) account.balanceRwf -= data.balanceRwf.decrement;
        return { count: 1 };
      },
    },
    financialEvent: {
      findUnique: async ({ where }: any) => {
        if (where.idempotencyKey) return eventsByKey.get(where.idempotencyKey) ?? null;
        if (where.id) return events.get(where.id) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const createdEntries = (data.entries?.create ?? []).map((entry: any, index: number) => ({
          id: `e-${events.size}-${index}`,
          ...entry,
        }));
        const event = {
          id: `evt-${events.size + 1}`,
          ...data,
          entries: createdEntries,
          status: 'POSTED',
        };
        delete event.entries.create;
        events.set(event.id, event);
        eventsByKey.set(event.idempotencyKey, event);
        entries.push(...createdEntries);
        return event;
      },
      update: async ({ where, data }: any) => {
        const event = events.get(where.id);
        Object.assign(event, data);
        return event;
      },
    },
  };

  const prisma: any = {
    ...tx,
    student: {
      ...tx.student,
      update: async ({ where, data }: any) => {
        const student = students.get(where.id)!;
        Object.assign(student, data);
        return student;
      },
    },
    idempotencyRecord: {
      findUnique: async ({ where }: any) => idempotency.get(where.key) ?? null,
      upsert: async ({ where, create }: any) => {
        idempotency.set(where.key, create);
        return create;
      },
    },
    $transaction: async (fn: (client: typeof tx) => Promise<any>) => fn(tx),
  };

  return { prisma, students, wallets, canteens, events, entries };
}

describe('FinanceService', () => {
  let service: FinanceService;
  let db: ReturnType<typeof createDb>;
  let pinHash: string;

  const studentId = 'stu-1';
  const walletId = 'wal-1';
  const canteenId = 'can-1';
  const cardId = 'card-1';

  beforeAll(async () => {
    pinHash = await bcrypt.hash('2468', 4);
  });

  beforeEach(() => {
    db = createDb();
    const wallet = { id: walletId, studentId, balanceRwf: 10000 };
    db.wallets.set(walletId, wallet);
    db.students.set(studentId, {
      id: studentId,
      status: StudentStatus.ACTIVE,
      pinEnabled: true,
      pinHash,
      pinFailedCount: 0,
      pinLockedUntil: null,
      wallet,
      cards: [{ id: cardId, status: CardStatus.ACTIVE, studentId }],
    });
    db.canteens.set(canteenId, {
      id: canteenId,
      isActive: true,
      account: { id: 'acc-1', canteenId, balanceRwf: 0 },
    });

    const cards = {
      authenticateCard: jest.fn(async (uid: string, token: string) => {
        if (uid === 'BLOCKED') {
          throw new BadRequestException('This card is blocked');
        }
        if (token !== 'valid-token-value-1') {
          throw new BadRequestException('Card authentication failed');
        }
        return { id: cardId, studentId, status: CardStatus.ACTIVE };
      }),
    } as unknown as CardsService;

    const config = {
      get: (key: string) => {
        if (key === 'PIN_MAX_ATTEMPTS') return 5;
        if (key === 'PIN_LOCK_MINUTES') return 15;
        return undefined;
      },
    } as unknown as ConfigService;

    service = new FinanceService(db.prisma, cards, config);
  });

  async function buy(overrides: Record<string, unknown> = {}) {
    return service.purchase({
      amountRwf: 2500,
      canteenId,
      studentId,
      pin: '2468',
      idempotencyKey: 'idemp-1',
      actorId: 'user-1',
      ...overrides,
    });
  }

  it('debits the student wallet and credits the canteen with balanced ledger entries', async () => {
    const result = await buy();
    const wallet = db.wallets.get(walletId)!;
    const canteen = db.canteens.get(canteenId)!;
    expect(wallet.balanceRwf).toBe(7500);
    expect(canteen.account.balanceRwf).toBe(2500);
    expect(result.event.entries).toHaveLength(2);
    const debit = result.event.entries.find((e: any) => e.side === 'DEBIT');
    const credit = result.event.entries.find((e: any) => e.side === 'CREDIT');
    expect(debit.accountType).toBe('STUDENT_WALLET');
    expect(credit.accountType).toBe('CANTEEN_ACCOUNT');
    expect(debit.amountRwf).toBe(credit.amountRwf);
  });

  it('rejects insufficient balances without moving money', async () => {
    await expect(buy({ amountRwf: 20000, idempotencyKey: 'idemp-low' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.wallets.get(walletId)!.balanceRwf).toBe(10000);
    expect(db.canteens.get(canteenId)!.account.balanceRwf).toBe(0);
    expect(db.events.size).toBe(0);
  });

  it('returns the original result for a duplicate idempotency key and does not double-charge', async () => {
    await buy();
    const second = await buy();
    expect(db.wallets.get(walletId)!.balanceRwf).toBe(7500);
    expect(db.canteens.get(canteenId)!.account.balanceRwf).toBe(2500);
    expect(second.event.amountRwf).toBe(2500);
  });

  it('rejects blocked cards before posting a purchase', async () => {
    await expect(
      buy({
        studentId: undefined,
        cardUid: 'BLOCKED',
        authToken: 'valid-token-value-1',
        idempotencyKey: 'idemp-block',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.wallets.get(walletId)!.balanceRwf).toBe(10000);
  });

  it('takes a fingerprint payment without a PIN', async () => {
    const result = await buy({ pin: undefined, identifiedBy: 'FINGERPRINT', idempotencyKey: 'fp-pay' });
    expect(result.wallet.balanceRwf).toBe(7500);
    expect(db.events.size).toBe(1);
  });

  it('records a test credit in a balanced ledger', async () => {
    const result = await service.testCredit({
      studentId,
      amountRwf: 1000,
      idempotencyKey: 'credit-1',
      actorId: 'admin-1',
    });
    expect(db.wallets.get(walletId)!.balanceRwf).toBe(11000);
    expect(result.event.entries).toHaveLength(2);
    const debit = result.event.entries.find((e: any) => e.side === 'DEBIT');
    const credit = result.event.entries.find((e: any) => e.side === 'CREDIT');
    expect(debit.accountType).toBe('SYSTEM_TEST_FUND');
    expect(credit.accountType).toBe('STUDENT_WALLET');
    expect(debit.amountRwf).toBe(credit.amountRwf);
  });

  it('keeps purchase and reversal ledgers balanced', async () => {
    const purchase = await buy();
    const reversal = await service.reverse({
      eventId: purchase.event.id,
      idempotencyKey: 'rev-1',
      actorId: 'admin-1',
    });
    expect(db.wallets.get(walletId)!.balanceRwf).toBe(10000);
    expect(db.canteens.get(canteenId)!.account.balanceRwf).toBe(0);
    const debit = reversal.event.entries
      .filter((e: any) => e.side === 'DEBIT')
      .reduce((s: number, e: any) => s + e.amountRwf, 0);
    const credit = reversal.event.entries
      .filter((e: any) => e.side === 'CREDIT')
      .reduce((s: number, e: any) => s + e.amountRwf, 0);
    expect(debit).toBe(credit);
    await expect(
      service.reverse({
        eventId: purchase.event.id,
        idempotencyKey: 'rev-2',
        actorId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
