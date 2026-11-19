-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pinHash" TEXT,
    "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pinFailedCount" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" DATETIME,
    "portalPasswordHash" TEXT,
    "portalFailedCount" INTEGER NOT NULL DEFAULT 0,
    "portalLockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0 CHECK ("balanceRwf" >= 0),
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Canteen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Canteen_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanteenAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canteenId" TEXT NOT NULL,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CanteenAccount_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "Canteen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformFeeAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balanceRwf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grossRwf" INTEGER NOT NULL,
    "feeRwf" INTEGER NOT NULL,
    "studentCreditRwf" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "payer" TEXT NOT NULL DEFAULT 'parent',
    "idempotencyKey" TEXT NOT NULL,
    "intouchRef" TEXT,
    "responseCode" TEXT,
    "statusDesc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FingerprintTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "finger" TEXT NOT NULL DEFAULT 'RIGHT_INDEX',
    "template" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL DEFAULT 'Live20R',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FingerprintTemplate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NfcCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardUid" TEXT NOT NULL,
    "authTokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "blockedAt" DATETIME,
    "blockedReason" TEXT,
    "replacedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NfcCard_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "NfcCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "amountRwf" INTEGER NOT NULL,
    "description" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "studentId" TEXT,
    "walletId" TEXT,
    "canteenId" TEXT,
    "cardId" TEXT,
    "createdById" TEXT NOT NULL,
    "reversesEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "Canteen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "NfcCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvent_reversesEventId_fkey" FOREIGN KEY ("reversesEventId") REFERENCES "FinancialEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amountRwf" INTEGER NOT NULL,
    "walletId" TEXT,
    "canteenAccountId" TEXT,
    "platformFeeAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FinancialEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_canteenAccountId_fkey" FOREIGN KEY ("canteenAccountId") REFERENCES "CanteenAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_platformFeeAccountId_fkey" FOREIGN KEY ("platformFeeAccountId") REFERENCES "PlatformFeeAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "statusCode" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Class_schoolId_name_key" ON "Class"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Student_schoolId_classId_idx" ON "Student"("schoolId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_studentId_key" ON "Wallet"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Canteen_schoolId_name_key" ON "Canteen"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenAccount_canteenId_key" ON "CanteenAccount"("canteenId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_requestId_key" ON "PaymentIntent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentIntent_studentId_status_idx" ON "PaymentIntent"("studentId", "status");

-- CreateIndex
CREATE INDEX "FingerprintTemplate_studentId_isActive_idx" ON "FingerprintTemplate"("studentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintTemplate_studentId_finger_key" ON "FingerprintTemplate"("studentId", "finger");

-- CreateIndex
CREATE UNIQUE INDEX "NfcCard_replacedById_key" ON "NfcCard"("replacedById");

-- CreateIndex
CREATE INDEX "NfcCard_cardUid_idx" ON "NfcCard"("cardUid");

-- CreateIndex
CREATE INDEX "NfcCard_studentId_status_idx" ON "NfcCard"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_idempotencyKey_key" ON "FinancialEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_reversesEventId_key" ON "FinancialEvent"("reversesEventId");

-- CreateIndex
CREATE INDEX "FinancialEvent_createdAt_idx" ON "FinancialEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialEvent_studentId_idx" ON "FinancialEvent"("studentId");

-- CreateIndex
CREATE INDEX "FinancialEvent_canteenId_idx" ON "FinancialEvent"("canteenId");

-- CreateIndex
CREATE INDEX "FinancialEvent_type_status_idx" ON "FinancialEvent"("type", "status");

-- CreateIndex
CREATE INDEX "LedgerEntry_eventId_idx" ON "LedgerEntry"("eventId");

-- CreateIndex
CREATE INDEX "LedgerEntry_walletId_idx" ON "LedgerEntry"("walletId");

-- CreateIndex
CREATE INDEX "LedgerEntry_canteenAccountId_idx" ON "LedgerEntry"("canteenAccountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_platformFeeAccountId_idx" ON "LedgerEntry"("platformFeeAccountId");

CREATE TABLE "_SqlGuard" (
    "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
    "ok" INTEGER NOT NULL CHECK ("ok" = 1)
);
