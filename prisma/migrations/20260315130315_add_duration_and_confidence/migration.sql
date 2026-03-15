-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "durationMs" INTEGER;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "confidence" DOUBLE PRECISION;
