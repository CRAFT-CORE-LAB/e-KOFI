-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';
ALTER TYPE "FinancialEventType" ADD VALUE 'PLATFORM_WITHDRAWAL';
ALTER TYPE "LedgerAccountType" ADD VALUE 'PLATFORM_FEE';

-- CreateTable
CREATE TABLE "PlatformFeeAccount" (
    "id" TEXT NOT NULL,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grossRwf" INTEGER NOT NULL,
    "feeRwf" INTEGER NOT NULL,
    "studentCreditRwf" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "intouchRef" TEXT,
    "responseCode" TEXT,
    "statusDesc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN "platformFeeAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_requestId_key" ON "PaymentIntent"("requestId");
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");
CREATE INDEX "PaymentIntent_studentId_status_idx" ON "PaymentIntent"("studentId", "status");
CREATE INDEX "LedgerEntry_platformFeeAccountId_idx" ON "LedgerEntry"("platformFeeAccountId");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_platformFeeAccountId_fkey" FOREIGN KEY ("platformFeeAccountId") REFERENCES "PlatformFeeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
