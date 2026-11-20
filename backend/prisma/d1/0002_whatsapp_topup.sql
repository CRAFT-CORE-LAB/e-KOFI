ALTER TABLE "PaymentIntent" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'PARENT_PORTAL';

CREATE INDEX "PaymentIntent_channel_createdAt_idx" ON "PaymentIntent"("channel", "createdAt");

CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuardianLinkCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianLinkCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waPhone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'INITIAL',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "studentId" TEXT,
    "schoolId" TEXT,
    "studentCode" TEXT,
    "studentName" TEXT,
    "className" TEXT,
    "schoolName" TEXT,
    "pendingStudentId" TEXT,
    "amountRwf" INTEGER,
    "payPhone" TEXT,
    "paymentAttempt" INTEGER NOT NULL DEFAULT 0,
    "paymentRequestId" TEXT,
    "notifiedStatus" TEXT,
    "linkFailures" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "waMessageId" TEXT,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudentGuardian_studentId_phone_key" ON "StudentGuardian"("studentId", "phone");
CREATE INDEX "StudentGuardian_phone_idx" ON "StudentGuardian"("phone");
CREATE INDEX "GuardianLinkCode_studentId_consumedAt_idx" ON "GuardianLinkCode"("studentId", "consumedAt");
CREATE UNIQUE INDEX "WhatsAppConversation_waPhone_key" ON "WhatsAppConversation"("waPhone");
CREATE UNIQUE INDEX "WhatsAppConversation_paymentRequestId_key" ON "WhatsAppConversation"("paymentRequestId");
CREATE INDEX "WhatsAppConversation_studentId_idx" ON "WhatsAppConversation"("studentId");
CREATE INDEX "WhatsAppConversation_state_idx" ON "WhatsAppConversation"("state");
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
