import fs from 'fs';

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
schema = schema.replace(
  `generator client {
  provider = "prisma-client-js"
}`,
  `generator client {
  provider   = "prisma-client-js"
  output     = "../src/generated/d1"
  engineType = "client"
}`,
);
schema = schema.replace(
  `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`,
  `datasource db {
  provider = "sqlite"
  url      = "file:./d1.sqlite"
}`,
);
schema = schema.replace(/enum \w+ \{[^}]+\}\r?\n\r?\n/g, '');
for (const name of [
  'UserRole',
  'StudentStatus',
  'CardStatus',
  'FingerPosition',
  'FinancialEventType',
  'PaymentIntentStatus',
  'FinancialEventStatus',
  'LedgerAccountType',
  'LedgerEntrySide',
]) {
  schema = schema.replaceAll(new RegExp(`\\b${name}\\b`, 'g'), 'String');
}
for (const value of ['ACTIVE', 'DEACTIVATED', 'BLOCKED', 'PENDING', 'POSTED', 'FAILED', 'RIGHT_INDEX', 'RIGHT_THUMB', 'LEFT_THUMB', 'LEFT_INDEX', 'OTHER']) {
  schema = schema.replaceAll(`@default(${value})`, `@default("${value}")`);
}
fs.writeFileSync('prisma/schema.d1.prisma', schema);
console.log('wrote prisma/schema.d1.prisma');
