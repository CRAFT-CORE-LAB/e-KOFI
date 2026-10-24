-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CASHIER');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "FinancialEventType" AS ENUM ('TEST_CREDIT', 'PURCHASE', 'REVERSAL');
CREATE TYPE "FinancialEventStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "LedgerAccountType" AS ENUM ('STUDENT_WALLET', 'CANTEEN_ACCOUNT', 'SYSTEM_TEST_FUND');
CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "pinHash" TEXT,
    "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pinFailedCount" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_balance_nonnegative" CHECK ("balanceRwf" >= 0)
);

CREATE TABLE "Canteen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Canteen_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanteenAccount" (
    "id" TEXT NOT NULL,
    "canteenId" TEXT NOT NULL,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canteen_balance_nonnegative" CHECK ("balanceRwf" >= 0)
);

CREATE TABLE "NfcCard" (
    "id" TEXT NOT NULL,
    "cardUid" TEXT NOT NULL,
    "authTokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEvent" (
    "id" TEXT NOT NULL,
    "type" "FinancialEventType" NOT NULL,
    "status" "FinancialEventStatus" NOT NULL DEFAULT 'POSTED',
    "amountRwf" INTEGER NOT NULL,
    "description" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "studentId" TEXT,
    "walletId" TEXT,
    "canteenId" TEXT,
    "cardId" TEXT,
    "createdById" TEXT NOT NULL,
    "reversesEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_event_amount_positive" CHECK ("amountRwf" > 0)
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "side" "LedgerEntrySide" NOT NULL,
    "amountRwf" INTEGER NOT NULL,
    "walletId" TEXT,
    "canteenAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ledger_amount_positive" CHECK ("amountRwf" > 0)
);

CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- Unique indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");
CREATE UNIQUE INDEX "Class_schoolId_name_key" ON "Class"("schoolId", "name");
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");
CREATE UNIQUE INDEX "Wallet_studentId_key" ON "Wallet"("studentId");
CREATE UNIQUE INDEX "Canteen_schoolId_name_key" ON "Canteen"("schoolId", "name");
CREATE UNIQUE INDEX "CanteenAccount_canteenId_key" ON "CanteenAccount"("canteenId");
CREATE UNIQUE INDEX "NfcCard_replacedById_key" ON "NfcCard"("replacedById");
CREATE UNIQUE INDEX "FinancialEvent_idempotencyKey_key" ON "FinancialEvent"("idempotencyKey");
CREATE UNIQUE INDEX "FinancialEvent_reversesEventId_key" ON "FinancialEvent"("reversesEventId");

-- One active card per hardware UID and per student
CREATE UNIQUE INDEX "NfcCard_active_uid_key" ON "NfcCard"("cardUid") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "NfcCard_active_student_key" ON "NfcCard"("studentId") WHERE "status" = 'ACTIVE';

CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");
CREATE INDEX "Student_schoolId_classId_idx" ON "Student"("schoolId", "classId");
CREATE INDEX "NfcCard_cardUid_idx" ON "NfcCard"("cardUid");
CREATE INDEX "NfcCard_studentId_status_idx" ON "NfcCard"("studentId", "status");
CREATE INDEX "FinancialEvent_createdAt_idx" ON "FinancialEvent"("createdAt");
CREATE INDEX "FinancialEvent_studentId_idx" ON "FinancialEvent"("studentId");
CREATE INDEX "FinancialEvent_canteenId_idx" ON "FinancialEvent"("canteenId");
CREATE INDEX "FinancialEvent_type_status_idx" ON "FinancialEvent"("type", "status");
CREATE INDEX "LedgerEntry_eventId_idx" ON "LedgerEntry"("eventId");
CREATE INDEX "LedgerEntry_walletId_idx" ON "LedgerEntry"("walletId");
CREATE INDEX "LedgerEntry_canteenAccountId_idx" ON "LedgerEntry"("canteenAccountId");

-- Foreign keys
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Canteen" ADD CONSTRAINT "Canteen_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CanteenAccount" ADD CONSTRAINT "CanteenAccount_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "Canteen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfcCard" ADD CONSTRAINT "NfcCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfcCard" ADD CONSTRAINT "NfcCard_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "NfcCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "Canteen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "NfcCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_reversesEventId_fkey" FOREIGN KEY ("reversesEventId") REFERENCES "FinancialEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FinancialEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_canteenAccountId_fkey" FOREIGN KEY ("canteenAccountId") REFERENCES "CanteenAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutability: posted ledger entries cannot be edited or deleted
CREATE OR REPLACE FUNCTION prevent_ledger_entry_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted ledger entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_no_update
  BEFORE UPDATE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE TRIGGER ledger_entry_no_delete
  BEFORE DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE OR REPLACE FUNCTION protect_financial_event()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial events cannot be deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW."amountRwf" IS DISTINCT FROM OLD."amountRwf"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
     OR NEW."canteenId" IS DISTINCT FROM OLD."canteenId"
     OR NEW."cardId" IS DISTINCT FROM OLD."cardId"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN
    RAISE EXCEPTION 'Posted financial event fields cannot be modified';
  END IF;
  IF OLD.status = 'REVERSED' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Reversed events cannot change status';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financial_event_protect
  BEFORE UPDATE OR DELETE ON "FinancialEvent"
  FOR EACH ROW EXECUTE FUNCTION protect_financial_event();
