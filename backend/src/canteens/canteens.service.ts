import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCanteenDto } from './dto/create-canteen.dto';

@Injectable()
export class CanteensService {
  constructor(private readonly prisma: PrismaService) {}

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
}
