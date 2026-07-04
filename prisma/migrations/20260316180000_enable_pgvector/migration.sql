-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- In development we don't need to preserve old float[] embeddings.
-- Drop the column and recreate it as pgvector with 1536 dimensions.
ALTER TABLE "KnowledgeDocument" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "KnowledgeDocument" ADD COLUMN "embedding" vector(1536);

-- Create IVF_FLAT index for fast cosine similarity search.
CREATE INDEX IF NOT EXISTS knowledge_embedding_idx
ON "KnowledgeDocument"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);

