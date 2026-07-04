# Integration Prompt: In-House Piper TTS + faster-whisper STT as Default Providers

> **Copy everything below this line and paste it into Claude Opus (or any coding agent) to implement the changes.**

---

## Your Task

Integrate a self-hosted **Voice AI API server** (FastAPI on a DigitalOcean droplet) as the **default STT and TTS providers** in the Bolna Voice AI platform (`/home/nirmit/Downloads/work/bolna`). Replace Deepgram and Sarvam as defaults — keep existing cloud providers as optional fallbacks.

Read `README.md` first for full project context.

---

## In-House Voice AI Server (already running)

The server runs on the droplet at **`http://<DROPLET_IP>:8000`** (configure via env var).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tts` | JSON `{text, voice?}` → streamed `audio/wav` |
| GET | `/tts?text=...&voice=...` | Same, convenience form |
| POST | `/stt` | multipart `file=<audio>` → `{"text", "language", ...}` |
| GET | `/voices` | List loaded voices, default, aliases |
| GET | `/health` | Liveness (`200` when TTS + STT ready) |

### Voice aliases (map to Agent `voice` field)

| Alias | Piper model |
|-------|-------------|
| `male1` | `en_US-lessac-medium` |
| `male2` | `en_US-ryan-medium` |
| `female1` | `en_US-amy-medium` |
| `female2` | `en_US-kathleen-low` |

### Key constraints

- **TTS output**: raw WAV (NOT μ-law). Bolna/Twilio needs **μ-law 8 kHz mono** base64 in WebSocket media events.
- **STT input**: accepts wav/mp3/webm/m4a via multipart upload — **NOT streaming**. Current Bolna STT is streaming (`sendAudio(chunk)` per 20 ms). You must implement a **buffered/batch STT adapter** with silence-based endpointing.
- **CPU-only, offline** — no API keys needed for this provider.
- **No auth** on the voice server (dev setup). Use env var for base URL only.

---

## Current Bolna Architecture (what you are modifying)

### Provider selection (defaults today)

- STT default: `DEEPGRAM` — see `initSttStream()` in `src/voiceGateway/streamHandler.ts` (~line 434)
- TTS default: `DEEPGRAM` — see `selectProvidersForSession()` (~line 1403)
- Prisma enum `SttProvider`: `DEEPGRAM | SARVAM | ELEVENLABS` in `prisma/schema.prisma`
- Agent `ttsProvider` is a free string: `DEEPGRAM`, `SARVAM`, `ELEVENLABS`, `CARTESIA`
- Seed default: `sttProvider: 'DEEPGRAM'` in `prisma/seed.ts`

### STT interface (must match)

All STT providers implement this pattern (see `src/stt/deepgramStream.ts`):

```typescript
export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

class SomeStream {
  constructor(callSid: string, config: {...})
  async connect(): Promise<void>
  sendAudio(audioBuffer: Buffer): boolean   // called ~50/sec with μ-law chunks
  onTranscript(callback: (result: TranscriptResult) => void): void
  async close(): Promise<void>
}
```

`streamHandler.startAudioStreamingLoop()` (~line 541) pulls from `audioQueue` and calls `sttClient.sendAudio(chunk)`.

`handleTranscript()` (~line 573) expects both **partial** (`isFinal: false`) and **final** (`isFinal: true`) transcripts. Partials drive early response via `handlePartialTranscript()` (~line 608).

### TTS interface (must match)

All TTS providers follow `DeepgramTTS` / `SarvamTTS` pattern in `src/tts/`:

```typescript
class SomeTTS {
  constructor(config: {...})
  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: string): Promise<void>
  abort(callSid: string): void
  clearQueue(callSid: string): void
  cleanup(callSid: string): void
  // optional: startStream, sendChunk, endStream, stopSpeaking
}
```

`speak()` must:
1. Set `session.isSpeaking = true` and `session.ttsAbortController = new AbortController()`
2. Stream μ-law 8 kHz audio to Twilio via WebSocket:

```typescript
ws.send(JSON.stringify({
  event: 'media',
  streamSid,
  media: { payload: base64MulawChunk },
}));
```

3. Chunk size: **160 bytes = 20 ms** at 8 kHz μ-law (see `src/tts/sarvamTTS.ts` ~line 219)
4. Support barge-in: check `session.ttsAbortController?.signal.aborted`, call `req.destroy()` on abort
5. On abort, send Twilio clear event: `{ event: 'clear', streamSid }`

Reference implementation for Twilio μ-law streaming: `src/tts/deepgramTTS.ts` (requests mulaw directly from API).

---

## Implementation Plan

### 1. Add new provider enum/value: `LOCAL` (or `INHOUSE`)

**Prisma** (`prisma/schema.prisma`):
```prisma
enum SttProvider {
  LOCAL      // NEW — default
  DEEPGRAM
  SARVAM
  ELEVENLABS
}
```
- Change `@default(DEEPGRAM)` → `@default(LOCAL)` on `Agent.sttProvider`
- Create migration

**Agent defaults**: new agents use `sttProvider: LOCAL`, `ttsProvider: LOCAL`

### 2. Create `src/tts/localTTS.ts` (Piper via HTTP)

**Config**:
```typescript
interface LocalTTSConfig {
  baseUrl: string;  // e.g. http://DROPLET_IP:8000
  defaultVoice?: string;  // default 'male1'
}
```

**Flow in `speak()`**:
1. `POST ${baseUrl}/tts` with `{ text, voice: voice || agent.voice || 'male1' }`
2. Receive full WAV buffer (or stream and accumulate)
3. **Convert WAV → μ-law 8 kHz**:
   - Parse WAV header, extract PCM (likely 22050 or 16000 Hz from Piper)
   - Resample to 8000 Hz mono
   - Encode to μ-law (G.711)
   - **Do NOT add ffmpeg as a hard runtime dependency if avoidable** — prefer a pure-JS library (`wavefile` + linear resampling + μ-law encode). If quality suffers, document optional ffmpeg path.
4. Send 160-byte chunks to Twilio WebSocket (same as SarvamTTS)
5. Implement queue + abort + cleanup matching DeepgramTTS

**Voice mapping**: Agent `voice` field accepts Piper aliases (`male1`, `female1`, etc.) or full names (`en_US-lessac-medium`).

### 3. Create `src/stt/localStream.ts` (faster-whisper via HTTP)

Because `/stt` is batch-only, implement a **buffered adapter**:

**Config**:
```typescript
interface LocalSttConfig {
  baseUrl: string;
  silenceThresholdMs?: number;  // default: agent.endpointingMs || 1000
  minSpeechMs?: number;         // default 600
}
```

**Behavior**:
1. `connect()`: no-op or health check `GET ${baseUrl}/health`
2. `sendAudio(buffer)`: append μ-law chunks to internal buffer; track `lastAudioTime`
3. **Silence detection**: if no audio for `silenceThresholdMs`, trigger transcription
4. **Transcribe**:
   - Convert accumulated μ-law buffer → WAV (8 kHz mono) in memory
   - `POST ${baseUrl}/stt` as multipart form: `file=@utterance.wav`
   - Parse `{ text, language }` from JSON response
5. Emit transcript:
   - First emit partial: `{ text, isFinal: false }` (optional, helps early response)
   - Then final: `{ text, isFinal: true, confidence: 1.0 }`
6. Clear buffer after final transcript
7. `close()`: flush any remaining buffer

**Important**: Run STT HTTP calls async (don't block `sendAudio`). Use a lock/debounce so concurrent calls don't overlap for the same `callSid`.

**Latency note**: Batch STT will be slower than Deepgram streaming (~1-3s on CPU). This is acceptable for v1.

### 4. Wire into `streamHandler.ts`

**Add env vars** (top of file):
```typescript
const VOICE_AI_BASE_URL = process.env.VOICE_AI_BASE_URL || 'http://localhost:8000';
```

**`initSttStream()`** — add branch BEFORE Deepgram fallback:
```typescript
if (provider === 'LOCAL') {
  const localStream = new LocalStream(session.callSid, {
    baseUrl: VOICE_AI_BASE_URL,
    silenceThresholdMs: session.agent?.endpointingMs ?? 1000,
  });
  localStream.onTranscript((result) => this.handleTranscript(session.callSid, result));
  await localStream.connect();
  session.sttClient = localStream;
  this.startAudioStreamingLoop(session, connectionId);
  return;
}
```

**Change defaults** from `'DEEPGRAM'` to `'LOCAL'` in:
- `initSttStream()` line ~435
- `selectProvidersForSession()` line ~1386, ~1404
- `logCallConfiguration()` line ~1347, ~1352

**Fallback chain**: LOCAL fails → log `[STT_PROVIDER_FALLBACK]` → try DEEPGRAM if `DEEPGRAM_API_KEY` set, else error.

**`selectProvidersForSession()` TTS** — add branch:
```typescript
if (ttsProvider === 'LOCAL') {
  session.ttsClient = new LocalTTS({ baseUrl: VOICE_AI_BASE_URL });
  // log [TTS_PROVIDER_SELECTED] provider: local
  return;
}
```

**Fallback**: LOCAL TTS fails → DEEPGRAM if key present.

**Fix `selectProvidersForSession` STT reinit logic** (~line 1388): currently only closes STT when switching away from DEEPGRAM. Update to handle LOCAL properly.

### 5. Environment variables

Add to `.env.example`:
```env
# In-house Voice AI server (Piper TTS + faster-whisper STT)
VOICE_AI_BASE_URL=http://YOUR_DROPLET_IP:8000

# Optional cloud fallbacks (not required if using LOCAL only)
DEEPGRAM_API_KEY=
SARVAM_API_KEY=
ELEVENLABS_API_KEY=
CARTESIA_API_KEY=
```

### 6. Dashboard updates

**`dashboard/lib/api.ts`**: extend types:
```typescript
sttProvider?: 'LOCAL' | 'DEEPGRAM' | 'SARVAM' | 'ELEVENLABS' | string;
ttsProvider?: 'LOCAL' | 'DEEPGRAM' | 'SARVAM' | 'ELEVENLABS' | 'CARTESIA' | string;
```

**`dashboard/app/page.tsx`** (agent config UI ~line 698-810):
- Add `LOCAL` / "In-House (Piper + Whisper)" as **first/default** option in STT and TTS dropdowns
- When `sttProvider === 'LOCAL'`: hide cloud model selectors; show note "Uses self-hosted faster-whisper"
- When `ttsProvider === 'LOCAL'`: voice dropdown with `male1`, `male2`, `female1`, `female2`
- Change default state from `'DEEPGRAM'` to `'LOCAL'`

**`dashboard/app/config/page.tsx`**: add `VOICE_AI_BASE_URL` field; de-emphasize Deepgram key (optional fallback).

### 7. Seed + README

**`prisma/seed.ts`**:
```typescript
sttProvider: 'LOCAL',
ttsProvider: 'LOCAL',
voice: 'male1',
```

**`README.md`**: update provider table, env vars, and "For AI Agents" section to document LOCAL as default.

### 8. Audio conversion utilities

Create `src/utils/audioConvert.ts` (shared by STT + TTS):

```typescript
// Functions needed:
mulawBufferToWav(mulaw: Buffer, sampleRate?: number): Buffer
wavToMulaw8k(wav: Buffer): Buffer
chunkMulaw(mulaw: Buffer, chunkSize?: number): Buffer[]
```

Use existing patterns from the codebase. Twilio audio is always μ-law 8 kHz mono.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/tts/localTTS.ts` | Piper TTS HTTP client + WAV→μ-law conversion |
| `src/stt/localStream.ts` | Buffered STT adapter for faster-whisper |
| `src/utils/audioConvert.ts` | μ-law ↔ WAV conversion helpers |
| `prisma/migrations/XXXX_add_local_provider/migration.sql` | Add LOCAL enum + change default |

## Files to Modify

| File | Changes |
|------|---------|
| `src/voiceGateway/streamHandler.ts` | Wire LOCAL providers, change defaults, update fallbacks |
| `prisma/schema.prisma` | Add LOCAL to SttProvider enum, change defaults |
| `prisma/seed.ts` | LOCAL defaults |
| `.env.example` | VOICE_AI_BASE_URL |
| `dashboard/lib/api.ts` | Type updates |
| `dashboard/app/page.tsx` | UI dropdowns + voice options |
| `dashboard/app/config/page.tsx` | VOICE_AI_BASE_URL config field |
| `README.md` | Document new default provider |

## Do NOT Change

- LLM layer (`src/llm/openrouterClient.ts`) — stays on OpenRouter
- Twilio gateway (`src/twilio/twimlController.ts`, `src/voiceGateway/gateway.ts`)
- Knowledge base / RAG
- Barge-in logic (must still work with LocalTTS abort)
- Existing Deepgram/Sarvam/ElevenLabs/Cartesia providers — keep as optional fallbacks

## Known Issues to Fix While Here (if quick)

1. **Hardcoded OpenRouter API key** in `streamHandler.ts` (~line 96) and `knowledgeService.ts` (~line 15) — replace with `process.env.OPENROUTER_API_KEY`

---

## Testing Checklist

After implementation, verify:

```bash
# 1. Voice server health (from dev machine)
curl http://DROPLET_IP:8000/health

# 2. TTS smoke test
curl -X POST http://DROPLET_IP:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello test","voice":"male1"}' -o test.wav

# 3. STT smoke test
curl -X POST http://DROPLET_IP:8000/stt -F "file=@test.wav"

# 4. Backend
npm run build
VOICE_AI_BASE_URL=http://DROPLET_IP:8000 npm run dev

# 5. Seed with LOCAL agent
npm run seed

# 6. Make a Twilio test call — expect logs:
# [STT_PROVIDER_SELECTED] provider: local
# [TTS_PROVIDER_SELECTED] provider: local
# [TRANSCRIPT] ...
# [TTS_START] ...
# [TTS_STREAM] ...
# [TTS_END] ...

# 7. Barge-in: interrupt AI mid-sentence → [BARGE_IN] [TTS_ABORTED]
```

---

## Design Decisions (follow these unless blocked)

1. **Provider name**: use `LOCAL` (not `PIPER` or `INHOUSE`) for both STT and TTS — one server, one provider.
2. **Default**: LOCAL everywhere; cloud providers are opt-in per agent.
3. **No new npm dependencies unless necessary** — prefer minimal additions (`wavefile` or similar for WAV parsing is OK).
4. **Match existing code style** — same logger pattern (`createLogger`), same `[TAG]` log format, same class structure as DeepgramTTS/DeepgramStream.
5. **Minimize diff scope** — don't refactor unrelated code.
6. **Graceful degradation** — if `VOICE_AI_BASE_URL` unreachable, fall back to Deepgram with clear log warning.

---

## Success Criteria

- [ ] New agents default to LOCAL STT + LOCAL TTS
- [ ] Inbound Twilio call transcribes speech via droplet `/stt`
- [ ] AI response speaks via droplet `/tts` with audible voice on phone
- [ ] Barge-in still cancels TTS mid-stream
- [ ] Dashboard shows LOCAL as default provider with Piper voice aliases
- [ ] `npm run build` passes with no TypeScript errors
- [ ] README updated
- [ ] Existing Deepgram/Sarvam/ElevenLabs agents still work when explicitly configured

---

## Reference: In-House Server Docs (summary)

```
POST /tts   {"text": "hello world", "voice": "male1"}   ->  streamed WAV
GET  /tts?text=hello world&voice=male1                  ->  streamed WAV
POST /stt   form-data: file=@audio.wav                  ->  {"text": "hello world"}
GET  /voices                                            ->  list of loaded voices
GET  /health                                            ->  200 when ready
```

Server stack: FastAPI + Piper TTS (onnx) + faster-whisper (CPU). Models preloaded in RAM. Binds `0.0.0.0:8000`. CORS open. No auth.
