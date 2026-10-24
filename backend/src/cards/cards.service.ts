import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus, Prisma, StudentStatus } from '@prisma/client';
import { generateCardToken, hashCardToken, tokensEqual } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { BlockCardDto } from './dto/block-card.dto';
import { RegisterCardDto } from './dto/register-card.dto';
import { ResolveCardDto } from './dto/resolve-card.dto';

const cardInclude = {
  student: {
    include: {
      school: true,
      class: true,
      wallet: true,
    },
  },
} satisfies Prisma.NfcCardInclude;

@Injectable()
export class CardsService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.pepper = config.get<string>('CARD_TOKEN_PEPPER') ?? 'dev-card-pepper';
  }

  list() {
    return this.prisma.nfcCard.findMany({
      include: cardInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const card = await this.prisma.nfcCard.findUnique({ where: { id }, include: cardInclude });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    return card;
  }

  async register(dto: RegisterCardDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { cards: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('Cannot assign a card to a deactivated student');
    }

    const cardUid = dto.cardUid.toUpperCase();
    const issuedToken = dto.authToken ?? generateCardToken();
    const authTokenHash = hashCardToken(issuedToken, this.pepper);

    const existingActiveUid = await this.prisma.nfcCard.findFirst({
      where: { cardUid, status: CardStatus.ACTIVE },
    });
    if (existingActiveUid) {
      throw new ConflictException('This NFC UID already has an active card');
    }

    const existingActiveStudent = student.cards.find((card) => card.status === CardStatus.ACTIVE);
    if (existingActiveStudent) {
      throw new ConflictException('Student already has an active card. Block it before assigning a replacement.');
    }

    try {
      const card = await this.prisma.nfcCard.create({
        data: {
          cardUid,
          authTokenHash,
          studentId: student.id,
          status: CardStatus.ACTIVE,
        },
        include: cardInclude,
      });
      return {
        card,
        authToken: issuedToken,
        writeToCard: !dto.authToken,
        message: dto.authToken
          ? 'Card registered using the secure token present on the tag.'
          : 'Card registered. Write the returned authToken to the tag NDEF record. UID alone is not accepted for payments.',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Active card uniqueness constraint violated');
      }
      throw error;
    }
  }

  async replace(blockedCardId: string, dto: RegisterCardDto) {
    const blocked = await this.prisma.nfcCard.findUnique({ where: { id: blockedCardId } });
    if (!blocked) {
      throw new NotFoundException('Card not found');
    }
    if (blocked.status !== CardStatus.BLOCKED) {
      throw new BadRequestException('Only a blocked card can be replaced');
    }
    if (blocked.replacedById) {
      throw new ConflictException('This card already has a replacement');
    }
    if (dto.studentId !== blocked.studentId) {
      throw new BadRequestException('Replacement must be assigned to the same student');
    }

    const result = await this.register(dto);
    await this.prisma.nfcCard.update({
      where: { id: blocked.id },
      data: { replacedById: result.card.id },
    });
    return result;
  }

  async block(id: string, dto: BlockCardDto) {
    const card = await this.prisma.nfcCard.findUnique({ where: { id } });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    if (card.status === CardStatus.BLOCKED) {
      throw new BadRequestException('Card is already blocked');
    }
    return this.prisma.nfcCard.update({
      where: { id },
      data: {
        status: CardStatus.BLOCKED,
        blockedAt: new Date(),
        blockedReason: dto.reason ?? 'Lost or stolen',
      },
      include: cardInclude,
    });
  }

  async resolve(dto: ResolveCardDto) {
    const card = await this.authenticateCard(dto.cardUid, dto.authToken);
    if (card.student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('Student account is deactivated');
    }
    return card;
  }

  async authenticateCard(cardUid: string, authToken: string) {
    const normalizedUid = cardUid.toUpperCase();
    const card = await this.prisma.nfcCard.findFirst({
      where: { cardUid: normalizedUid, status: CardStatus.ACTIVE },
      include: cardInclude,
    });
    if (!card) {
      const any = await this.prisma.nfcCard.findFirst({ where: { cardUid: normalizedUid } });
      if (any?.status === CardStatus.BLOCKED) {
        throw new BadRequestException('This card is blocked');
      }
      throw new UnauthorizedException('Unknown or inactive card');
    }
    const expected = hashCardToken(authToken, this.pepper);
    if (!tokensEqual(expected, card.authTokenHash)) {
      throw new UnauthorizedException('Card authentication failed');
    }
    return card;
  }
}
