import { PrismaClient, UserRole, StudentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const cashierHash = await bcrypt.hash('Cashier123!', 12);
  const pinHash = await bcrypt.hash('2468', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ekofi.local' },
    update: {},
    create: {
      email: 'admin@ekofi.local',
      passwordHash: adminHash,
      name: 'School Administrator',
      role: UserRole.ADMIN,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@ekofi.local' },
    update: {},
    create: {
      email: 'cashier@ekofi.local',
      passwordHash: cashierHash,
      name: 'Canteen Cashier',
      role: UserRole.CASHIER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'owner@ekofi.local' },
    update: { role: UserRole.SUPERADMIN, name: 'e-KOFI Owner' },
    create: {
      email: 'owner@ekofi.local',
      passwordHash: await bcrypt.hash('Owner123!', 12),
      name: 'e-KOFI Owner',
      role: UserRole.SUPERADMIN,
    },
  });

  await prisma.platformFeeAccount.upsert({
    where: { id: '00000000-0000-4000-8000-0000000000fe' },
    update: {},
    create: { id: '00000000-0000-4000-8000-0000000000fe', balanceRwf: 0 },
  });

  await prisma.user.upsert({
    where: { email: 'parent-portal@ekofi.system' },
    update: { name: 'Parent portal' },
    create: {
      email: 'parent-portal@ekofi.system',
      passwordHash: await bcrypt.hash(`parent-portal-${Date.now()}`, 12),
      name: 'Parent portal',
      role: UserRole.ADMIN,
    },
  });

  const school = await prisma.school.upsert({
    where: { name: 'Kigali Green Hills School' },
    update: {},
    create: { name: 'Kigali Green Hills School' },
  });

  const p6a = await prisma.class.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'P6 A' } },
    update: {},
    create: { schoolId: school.id, name: 'P6 A' },
  });

  const s1b = await prisma.class.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'S1 B' } },
    update: {},
    create: { schoolId: school.id, name: 'S1 B' },
  });

  const aime = await prisma.student.upsert({
    where: { studentCode: 'STU-000001' },
    update: {},
    create: {
      studentCode: 'STU-000001',
      firstName: 'Aime',
      lastName: 'Uwase',
      schoolId: school.id,
      classId: p6a.id,
      status: StudentStatus.ACTIVE,
      pinHash,
      pinEnabled: true,
      wallet: { create: { balanceRwf: 0 } },
    },
    include: { wallet: true },
  });

  const keza = await prisma.student.upsert({
    where: { studentCode: 'STU-000002' },
    update: {},
    create: {
      studentCode: 'STU-000002',
      firstName: 'Keza',
      lastName: 'Mugisha',
      schoolId: school.id,
      classId: p6a.id,
      status: StudentStatus.ACTIVE,
      wallet: { create: { balanceRwf: 0 } },
    },
    include: { wallet: true },
  });

  await prisma.student.upsert({
    where: { studentCode: 'STU-000003' },
    update: {},
    create: {
      studentCode: 'STU-000003',
      firstName: 'Eric',
      lastName: 'Niyonsaba',
      schoolId: school.id,
      classId: s1b.id,
      status: StudentStatus.DEACTIVATED,
      wallet: { create: { balanceRwf: 0 } },
    },
  });

  const canteen = await prisma.canteen.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'Main Canteen' } },
    update: {},
    create: {
      name: 'Main Canteen',
      schoolId: school.id,
      account: { create: { balanceRwf: 0 } },
    },
    include: { account: true },
  });

  const aimeWallet = aime.wallet ?? (await prisma.wallet.findUnique({ where: { studentId: aime.id } }));
  const kezaWallet = keza.wallet ?? (await prisma.wallet.findUnique({ where: { studentId: keza.id } }));

  if (!aimeWallet || !kezaWallet || !canteen.account) {
    throw new Error('Seed wallets or canteen account missing');
  }

  const creditKey = 'seed-test-credit-aime';
  const existingCredit = await prisma.financialEvent.findUnique({
    where: { idempotencyKey: creditKey },
  });

  if (!existingCredit) {
    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: aimeWallet.id },
        data: { balanceRwf: { increment: 15000 } },
      });
      await tx.financialEvent.create({
        data: {
          type: 'TEST_CREDIT',
          amountRwf: 15000,
          description: 'Development test credit',
          idempotencyKey: creditKey,
          studentId: aime.id,
          walletId: aimeWallet.id,
          createdById: admin.id,
          entries: {
            create: [
              {
                accountType: 'SYSTEM_TEST_FUND',
                side: 'DEBIT',
                amountRwf: 15000,
              },
              {
                accountType: 'STUDENT_WALLET',
                side: 'CREDIT',
                amountRwf: 15000,
                walletId: aimeWallet.id,
              },
            ],
          },
        },
      });
    });
  }

  const purchaseKey = 'seed-purchase-aime-lunch';
  const existingPurchase = await prisma.financialEvent.findUnique({
    where: { idempotencyKey: purchaseKey },
  });

  if (!existingPurchase) {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: aimeWallet.id } });
      if (wallet.balanceRwf < 2500) {
        return;
      }
      await tx.wallet.update({
        where: { id: aimeWallet.id },
        data: { balanceRwf: { decrement: 2500 } },
      });
      await tx.canteenAccount.update({
        where: { id: canteen.account!.id },
        data: { balanceRwf: { increment: 2500 } },
      });
      await tx.financialEvent.create({
        data: {
          type: 'PURCHASE',
          amountRwf: 2500,
          description: 'Seed lunch purchase',
          idempotencyKey: purchaseKey,
          studentId: aime.id,
          walletId: aimeWallet.id,
          canteenId: canteen.id,
          createdById: cashier.id,
          entries: {
            create: [
              {
                accountType: 'STUDENT_WALLET',
                side: 'DEBIT',
                amountRwf: 2500,
                walletId: aimeWallet.id,
              },
              {
                accountType: 'CANTEEN_ACCOUNT',
                side: 'CREDIT',
                amountRwf: 2500,
                canteenAccountId: canteen.account!.id,
              },
            ],
          },
        },
      });
    });
  }

  console.log('Seed complete.');
  console.log('Admin:   admin@ekofi.local / Admin123!');
  console.log('Cashier: cashier@ekofi.local / Cashier123!');
  console.log('Owner:   owner@ekofi.local / Owner123!');
  console.log('Demo student PIN for Aime Uwase: 2468');
  console.log('Register fingerprints in the mobile app for canteen payments.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
