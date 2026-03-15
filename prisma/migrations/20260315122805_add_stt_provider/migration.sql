-- CreateEnum
CREATE TYPE "SttProvider" AS ENUM ('DEEPGRAM', 'SARVAM');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "sttProvider" "SttProvider" NOT NULL DEFAULT 'DEEPGRAM';
