CREATE TYPE "FingerPosition" AS ENUM ('RIGHT_THUMB', 'RIGHT_INDEX', 'LEFT_THUMB', 'LEFT_INDEX', 'OTHER');

CREATE TABLE "FingerprintTemplate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "finger" "FingerPosition" NOT NULL DEFAULT 'RIGHT_INDEX',
    "template" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL DEFAULT 'Live20R',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FingerprintTemplate_studentId_finger_key" ON "FingerprintTemplate"("studentId", "finger");
CREATE INDEX "FingerprintTemplate_studentId_isActive_idx" ON "FingerprintTemplate"("studentId", "isActive");

ALTER TABLE "FingerprintTemplate" ADD CONSTRAINT "FingerprintTemplate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
