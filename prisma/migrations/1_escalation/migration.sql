-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN     "lastTriggerDay" TEXT,
ADD COLUMN     "lastTriggerStep" INTEGER;

