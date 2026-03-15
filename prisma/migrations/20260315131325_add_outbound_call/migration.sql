-- CreateTable
CREATE TABLE "OutboundCall" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "agentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "callSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundCall_pkey" PRIMARY KEY ("id")
);
