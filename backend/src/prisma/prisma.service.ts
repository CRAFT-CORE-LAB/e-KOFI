import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const d1 = (globalThis as { __EKOF_D1?: unknown }).__EKOF_D1;
    if (d1) {
      super({ adapter: new PrismaD1(d1 as ConstructorParameters<typeof PrismaD1>[0]) } as never);
      return;
    }
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
