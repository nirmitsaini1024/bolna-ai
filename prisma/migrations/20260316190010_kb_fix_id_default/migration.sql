-- Ensure KnowledgeDocument.id gets a default UUID in Postgres

-- Enable pgcrypto (provides gen_random_uuid) if not already enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "KnowledgeDocument"
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

