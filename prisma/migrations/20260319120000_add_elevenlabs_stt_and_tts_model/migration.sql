-- Add ELEVENLABS to SttProvider enum
ALTER TYPE "SttProvider" ADD VALUE IF NOT EXISTS 'ELEVENLABS';

-- Add optional ttsModel to Agent
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "ttsModel" TEXT;

