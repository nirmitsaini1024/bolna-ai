/*
  Warnings:

  - Added the required column `sourceId` to the `KnowledgeDocument` table without a default value. This is not possible if the table is not empty.
  - Made the column `embedding` on table `KnowledgeDocument` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "KnowledgeDocument_agentId_fkey";

-- DropIndex
DROP INDEX "knowledge_embedding_idx";

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "sourceId" TEXT NOT NULL,
ALTER COLUMN "agentId" DROP NOT NULL,
ALTER COLUMN "embedding" SET NOT NULL;

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledgeSource" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentKnowledgeSource_agentId_idx" ON "AgentKnowledgeSource"("agentId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeSource_sourceId_idx" ON "AgentKnowledgeSource"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKnowledgeSource_agentId_sourceId_key" ON "AgentKnowledgeSource"("agentId", "sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_sourceId_idx" ON "KnowledgeDocument"("sourceId");

-- AddForeignKey
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
