import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus, StudentStatus } from '@prisma/client';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  const student = {
    id: 'stu-1',
    status: StudentStatus.ACTIVE,
    cards: [] as any[],
  };

  let cards: any[];
  let service: CardsService;

  beforeEach(() => {
    cards = [];
    const prisma: any = {
      student: {
        findUnique: async () => ({ ...student, cards: cards.filter((c) => c.studentId === student.id) }),
      },
      nfcCard: {
        findFirst: async ({ where }: any) =>
          cards.find((card) => {
            if (where.cardUid && card.cardUid !== where.cardUid) return false;
            if (where.status && card.status !== where.status) return false;
            return true;
          }) ?? null,
        findUnique: async ({ where }: any) => cards.find((card) => card.id === where.id) ?? null,
        create: async ({ data }: any) => {
          const card = { id: `card-${cards.length + 1}`, ...data };
          cards.push(card);
          return { ...card, student };
        },
        update: async ({ where, data }: any) => {
          const card = cards.find((item) => item.id === where.id);
          Object.assign(card, data);
          return { ...card, student };
        },
      },
    };
    const config = {
      get: () => 'pepper',
    } as unknown as ConfigService;
    service = new CardsService(prisma, config);
  });

  it('registers an active card for a student', async () => {
    const result = await service.register({
      studentId: 'stu-1',
      cardUid: '04AABBCC',
    });
    expect(result.card.status).toBe(CardStatus.ACTIVE);
    expect(result.authToken.startsWith('EKOFI-')).toBe(true);
    expect(result.writeToCard).toBe(true);
  });

  it('rejects a second active card for the same student', async () => {
    await service.register({ studentId: 'stu-1', cardUid: '04AAAAAA' });
    await expect(
      service.register({ studentId: 'stu-1', cardUid: '04BBBBBB' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks a lost card so it cannot remain active', async () => {
    const created = await service.register({ studentId: 'stu-1', cardUid: '04CCCCCC' });
    const blocked = await service.block(created.card.id, { reason: 'Lost on campus' });
    expect(blocked.status).toBe(CardStatus.BLOCKED);
    const replacement = await service.replace(created.card.id, {
      studentId: 'stu-1',
      cardUid: '04DDDDDD',
    });
    expect(replacement.card.status).toBe(CardStatus.ACTIVE);
    expect(cards.filter((c) => c.status === CardStatus.ACTIVE)).toHaveLength(1);
  });

  it('rejects replacing a card that is still active', async () => {
    const created = await service.register({ studentId: 'stu-1', cardUid: '04EEEEEE' });
    await expect(
      service.replace(created.card.id, { studentId: 'stu-1', cardUid: '04FFFFFF' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
