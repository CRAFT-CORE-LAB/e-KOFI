-- AlterTable
ALTER TABLE "Student" ADD COLUMN "portalPasswordHash" TEXT;
ALTER TABLE "Student" ADD COLUMN "portalFailedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "portalLockedUntil" TIMESTAMP(3);
