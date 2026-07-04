-- Add LOCAL (in-house Piper TTS + faster-whisper STT) to SttProvider and make it the default.
-- Recreate the enum so the new value is usable within this migration's transaction.
CREATE TYPE "SttProvider_new" AS ENUM ('LOCAL', 'DEEPGRAM', 'SARVAM', 'ELEVENLABS');
ALTER TABLE "Agent" ALTER COLUMN "sttProvider" DROP DEFAULT;
ALTER TABLE "Agent" ALTER COLUMN "sttProvider" TYPE "SttProvider_new" USING ("sttProvider"::text::"SttProvider_new");
ALTER TYPE "SttProvider" RENAME TO "SttProvider_old";
ALTER TYPE "SttProvider_new" RENAME TO "SttProvider";
DROP TYPE "SttProvider_old";
ALTER TABLE "Agent" ALTER COLUMN "sttProvider" SET DEFAULT 'LOCAL';
