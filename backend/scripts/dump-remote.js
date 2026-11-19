const { PrismaClient } = require('@prisma/client');

const delegates = [
  'user',
  'school',
  'class',
  'student',
  'wallet',
  'canteen',
  'canteenAccount',
  'platformFeeAccount',
  'paymentIntent',
  'fingerprintTemplate',
  'nfcCard',
  'financialEvent',
  'ledgerEntry',
  'idempotencyRecord',
];

(async () => {
  const prisma = new PrismaClient();
  const out = {};
  for (const name of delegates) {
    out[name] = await prisma[name].findMany();
  }
  process.stdout.write(JSON.stringify(out));
  await prisma.$disconnect();
})().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
