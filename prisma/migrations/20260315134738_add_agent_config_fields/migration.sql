-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "llmModel" TEXT,
ADD COLUMN     "maxTokens" INTEGER,
ADD COLUMN     "ttsProvider" TEXT,
ADD COLUMN     "welcomeMessage" TEXT;

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);
