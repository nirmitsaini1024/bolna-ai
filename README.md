# Bolna — Voice AI Platform

![Dashboard](public/Screenshot%20from%202026-07-04%2016-11-01.png)

![Dashboard](public/Screenshot%20from%202026-07-04%2016-11-38.png)

![Dashboard](public/Screenshot%20from%202026-07-04%2016-11-57.png)

![Dashboard](public/Screenshot%20from%202026-07-04%2016-12-21.png)

Production-grade Voice AI platform (similar to Bolna, Vapi, Retell) with real-time phone calls via Twilio, configurable AI agents, knowledge-base RAG, analytics, and a Next.js dashboard.

---

## For AI Agents / ChatGPT Handoff

**Use this section when pasting the repo into another agent.** It summarizes what the project is, how it works, and where to look.

### What this repo does

1. **Receives phone calls** via Twilio Media Streams (WebSocket, μ-law 8 kHz audio).
2. **Transcribes speech** with configurable STT — default **LOCAL** (in-house faster-whisper server), or Deepgram, Sarvam, ElevenLabs.
3. **Reasons with an LLM** via OpenRouter (GPT-4o, Claude, etc.).
4. **Speaks back** with configurable TTS — default **LOCAL** (in-house Piper server), or Deepgram, ElevenLabs, Cartesia, Sarvam.
5. **Supports barge-in** — callers can interrupt the AI mid-sentence.
6. **Stores call history**, messages, tool events, and customer records in PostgreSQL.
7. **Retrieves knowledge** from a pgvector-backed knowledge base per agent.
8. **Manages agents** via REST API and a Next.js dashboard.

### Monorepo layout

| Path | Role |
|------|------|
| `src/` | Backend: Express HTTP + WebSocket voice gateway |
| `dashboard/` | Frontend: Next.js 15 admin UI (port 3001) |
| `prisma/` | PostgreSQL schema + migrations (requires pgvector) |

### Critical entry points

| Task | File |
|------|------|
| All HTTP routes | `src/server.ts` |
| WebSocket / call lifecycle | `src/voiceGateway/gateway.ts` |
| Per-call pipeline (STT→LLM→TTS) | `src/voiceGateway/streamHandler.ts` (~1580 lines) |
| Twilio TwiML webhook | `src/twilio/twimlController.ts` |
| Agent CRUD | `src/agents/agentController.ts`, `agentRepository.ts` |
| Agent lookup by phone | `src/agents/agentService.ts` |
| Knowledge RAG | `src/knowledge/knowledgeService.ts` |
| LLM client | `src/llm/openrouterClient.ts` |
| Dashboard API client | `dashboard/lib/api.ts` |
| DB schema | `prisma/schema.prisma` |

### Call flow (inbound)

```
Caller dials Twilio number
  → POST /voice (TwiML: <Connect><Stream url="wss://.../stream">)
  → WebSocket /stream opens
  → START event: create CallSession, load Agent (by agentId param or toPhoneNumber)
  → MEDIA events: decode μ-law → STT stream → partial/final transcripts
  → Final transcript → KB retrieval → LLM (with tools) → TTS → audio back to caller
  → STOP event: persist call, cleanup session
```

**Agent resolution order** (in `streamHandler.loadAgentForSession`):
1. `agentId` custom parameter from TwiML Stream (outbound calls)
2. `toPhoneNumber` → `PhoneNumber` table → `Agent`

### Agent model (key fields)

Agents are stored in PostgreSQL (`Agent` model). Important config:

- **LLM**: `llmProvider`, `llmModel`, `llmTemperature`, `llmTokens`, `systemPrompt`, `welcomeMessage`
- **STT**: `sttProvider` (`LOCAL` (default) \| `DEEPGRAM` \| `SARVAM` \| `ELEVENLABS`), `sttModel`, `language`
- **TTS**: `ttsProvider` (`LOCAL` (default) \| `DEEPGRAM` \| `ELEVENLABS` \| `CARTESIA` \| `SARVAM`), `ttsModel`, `voice`, `speechRate`, `stability`, etc.

### LOCAL provider (in-house Voice AI server)

`LOCAL` is the default STT + TTS provider. It talks to a self-hosted FastAPI
server (Piper TTS + faster-whisper STT, CPU-only, no API keys) at
`VOICE_AI_BASE_URL` (default `http://localhost:8000`):

- **TTS**: `POST /tts {text, voice}` returns WAV; `src/tts/localTTS.ts` converts
  it to μ-law 8 kHz in-process (`src/utils/audioConvert.ts`, pure JS — no ffmpeg)
  and streams 160-byte frames to Twilio. Voices: `male1`, `male2`, `female1`,
  `female2` (Piper aliases), or full Piper model names like `en_US-lessac-medium`.
- **STT**: `/stt` is batch-only, so `src/stt/localStream.ts` buffers μ-law audio,
  does energy-based silence endpointing (`endpointingMs`, default 1000 ms), then
  uploads the utterance as WAV and emits a final transcript. Expect ~1–3 s
  latency on CPU (slower than streaming Deepgram).
- **Fallback**: if the server is unreachable at call setup, the pipeline logs
  `[STT_PROVIDER_FALLBACK]` / `[TTS_PROVIDER_FALLBACK_TO_DEEPGRAM]` and uses
  Deepgram when `DEEPGRAM_API_KEY` is set.
- **Behavior**: `interruptWords`, `endpointingMs`, `silenceTimeout`, `maxCallDuration`, `finalCallMessage`

### Knowledge base

- **Global sources**: PDF upload or URL scrape → chunked (~700 chars) → embedded (1536-dim via OpenRouter) → stored in `KnowledgeDocument` with pgvector.
- **Agent attachment**: Many-to-many via `AgentKnowledgeSource` (not by `agentId` on chunks alone).
- **Retrieval**: On each user utterance, `knowledgeService.searchRelevantDocs(agentId, query, limit=3)` injects context into the LLM prompt.

### Known issues (important for contributors)

1. **Hardcoded API keys** in `src/voiceGateway/streamHandler.ts` and `src/knowledge/knowledgeService.ts` — marked `TEMP` for debugging. Should use `process.env.OPENROUTER_API_KEY`.
2. **Dashboard API references** some routes not yet in `server.ts` (e.g. `GET /agents/:id`, `/agents/:id/tools`). Dashboard may 404 for those.
3. **Auth is partial** — JWT middleware on some routes only; most agent/call/knowledge routes are unauthenticated.
4. **Phone number normalization** in seed strips non-digits; Twilio may send E.164 with `+` — verify matching in `agentService.normalizePhoneNumber`.

---

## Architecture

```
┌─────────────┐     POST /voice      ┌──────────────────┐
│   Twilio    │ ──────────────────►  │  Express Server  │
│  (Phone)    │                      │  (port 3000)     │
└──────┬──────┘                      └────────┬─────────┘
       │                                      │
       │  WebSocket /stream                   │  REST API
       ▼                                      ▼
┌──────────────────┐                 ┌──────────────────┐
│  Voice Gateway   │                 │  Dashboard       │
│  streamHandler   │                 │  (Next.js 3001)  │
└────────┬─────────┘                 └──────────────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
  STT       LLM        TTS      PostgreSQL
(LOCAL*    (OpenRouter) (LOCAL*  + pgvector
 Deepgram               + multi)
 Sarvam       *LOCAL = in-house Piper +
 ElevenLabs)   faster-whisper server
```

### Audio format (Twilio Media Streams)

| Property | Value |
|----------|-------|
| Encoding | μ-law (G.711), base64 in JSON |
| Sample rate | 8000 Hz |
| Channels | 1 (mono) |
| Chunk size | ~160 bytes / 20 ms |
| Tracks | `inbound` (caller), `outbound` (to caller) |

### Barge-in

When `ENABLE_BARGE_IN=true` and AI is speaking (`CallSession.isSpeaking`):
- Inbound audio triggers `handleBargeIn()`
- Aborts TTS via `AbortController`, clears queue
- Processes new user speech

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, TypeScript |
| HTTP | Express 4 |
| WebSocket | `ws` |
| Database | PostgreSQL + Prisma 7 + pgvector |
| Telephony | Twilio (Media Streams, outbound calls) |
| STT | **LOCAL (in-house faster-whisper, default)**, Deepgram, Sarvam, ElevenLabs |
| LLM | OpenRouter (OpenAI, Anthropic, etc.) |
| TTS | **LOCAL (in-house Piper, default)**, Deepgram, ElevenLabs, Cartesia, Sarvam |
| Embeddings | OpenRouter embedding model |
| Dashboard | Next.js, Tailwind CSS |
| Auth | JWT (bcryptjs + jsonwebtoken) |

---

## Project Structure

```
bolna/
├── src/
│   ├── server.ts                 # Main entry: HTTP routes + server bootstrap
│   ├── voiceGateway/
│   │   ├── gateway.ts            # WebSocket server, session metrics, hangup
│   │   ├── streamHandler.ts      # Core call pipeline (STT/LLM/TTS/RAG/tools)
│   │   ├── audioQueue.ts         # Audio buffer for STT
│   │   └── types.ts              # CallSession, Twilio events
│   ├── stt/
│   │   ├── localStream.ts        # LOCAL: buffered faster-whisper adapter (default)
│   │   ├── deepgramStream.ts
│   │   ├── sarvamStream.ts
│   │   └── elevenlabsStream.ts
│   ├── llm/
│   │   └── openrouterClient.ts   # Chat completions + tool calls
│   ├── tts/
│   │   ├── localTTS.ts           # LOCAL: Piper HTTP client + WAV→μ-law (default)
│   │   ├── deepgramTTS.ts
│   │   ├── elevenlabsTTS.ts
│   │   ├── cartesiaTTS.ts
│   │   └── sarvamTTS.ts
│   ├── twilio/
│   │   └── twimlController.ts    # POST /voice → TwiML
│   ├── agents/
│   │   ├── agentController.ts    # REST handlers
│   │   ├── agentRepository.ts    # Prisma queries
│   │   └── agentService.ts       # Cache + phone lookup
│   ├── knowledge/
│   │   ├── knowledgeService.ts   # Ingest + RAG search
│   │   ├── knowledgeRepository.ts
│   │   └── embeddingService.ts
│   ├── tools/
│   │   ├── toolRegistry.ts
│   │   ├── toolService.ts
│   │   ├── toolExecutor.ts
│   │   └── toolTypes.ts
│   ├── analytics/
│   │   ├── callService.ts
│   │   ├── messageService.ts
│   │   └── analyticsService.ts
│   ├── outbound/
│   │   ├── outboundController.ts
│   │   └── outboundService.ts
│   ├── customers/
│   │   ├── customerService.ts
│   │   └── customerRepository.ts
│   ├── billing/
│   │   ├── billingService.ts
│   │   └── usageService.ts
│   ├── auth/
│   │   ├── authController.ts
│   │   ├── authService.ts
│   │   └── jwtMiddleware.ts
│   └── utils/
│       └── logger.ts
├── dashboard/
│   ├── app/
│   │   ├── page.tsx              # Dashboard home
│   │   ├── login/page.tsx
│   │   ├── calls/page.tsx        # Call history
│   │   ├── calls/[id]/page.tsx   # Call detail + transcript
│   │   ├── calls/live/page.tsx   # Active calls monitor
│   │   ├── knowledge/page.tsx    # Global KB management
│   │   ├── agents/[agentId]/knowledge/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── logs/page.tsx
│   │   └── config/page.tsx       # Agent configuration
│   ├── components/sidebar.tsx
│   └── lib/
│       ├── api.ts                # BolnaAPI client
│       └── models.ts             # LLM model options
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── scripts/test-call.js
├── setup-all.sh
├── start.sh
└── package.json
```

---

## Database Schema (Prisma)

| Model | Purpose |
|-------|---------|
| `Agent` | Voice agent config (prompt, LLM/STT/TTS settings) |
| `PhoneNumber` | Maps Twilio number → Agent |
| `KnowledgeSource` | PDF/URL source metadata |
| `KnowledgeDocument` | Text chunks + `vector(1536)` embedding |
| `AgentKnowledgeSource` | M2M: which sources an agent uses |
| `Call` | Call record (callSid, duration, agentId) |
| `Message` | Transcript messages (user/assistant) per call |
| `Tool` / `ToolEvent` | Agent tools + execution logs |
| `Customer` / `CustomerNote` | Caller CRM |
| `Organization` / `User` | Multi-tenant auth |
| `OutboundCall` | Outbound call tracking |
| `UsageRecord` | Billing usage |

**Requires**: PostgreSQL with `pgvector` extension (see migration `20260316180000_enable_pgvector`).

---

## API Reference

Base URL: `http://localhost:3000` (backend)

### Health & Twilio

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Uptime, active connections/sessions |
| POST | `/voice` | Twilio webhook → TwiML (do not call manually) |
| WS | `/stream` | Twilio Media Stream (internal) |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register user + org |
| POST | `/auth/login` | — | Returns JWT |
| GET | `/billing/usage` | JWT | Org usage summary |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/agents` | List all agents |
| POST | `/agents` | Create agent |
| PUT | `/agents/:id` | Update agent |
| DELETE | `/agents/:id` | Delete agent |
| GET | `/agents/:id/knowledge-sources` | List attached KB source IDs |
| PUT | `/agents/:id/knowledge-sources` | Set attached sources `{ sourceIds: [] }` |
| POST | `/agents/:agentId/knowledge` | Add raw text doc (JWT) |

### Calls

| Method | Path | Description |
|--------|------|-------------|
| GET | `/calls` | List calls (`?limit=N`) |
| GET | `/calls/active` | Live sessions with transcript preview |
| GET | `/calls/:id/messages` | Transcript for a call |
| POST | `/calls/:callSid/hangup` | End call (Twilio + local cleanup) |
| POST | `/call` | Outbound test call `{ to, agentId }` |
| POST | `/outbound/call` | Outbound call `{ phone, agentId }` |

### Knowledge Base

| Method | Path | Description |
|--------|------|-------------|
| POST | `/knowledge/upload` | PDF upload (multipart: `file`, optional `agentId`) |
| POST | `/knowledge/url` | Scrape URL `{ url, agentId? }` |
| GET | `/knowledge/source` | List all sources |
| DELETE | `/knowledge/source/:id` | Delete source + chunks |

---

## Environment Variables

Create `.env` in the repo root (see `.env.example`):

```env
# Server
PORT=3000
NGROK_URL=wss://your-subdomain.ngrok-free.app   # WebSocket URL for Twilio
PUBLIC_URL=https://your-subdomain.ngrok-free.app # HTTP URL for outbound webhooks
DASHBOARD_ORIGIN=http://localhost:3001

# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/bolna

# Twilio (required for calls)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=+1234567890

# In-house Voice AI server (Piper TTS + faster-whisper STT) — default LOCAL provider
VOICE_AI_BASE_URL=http://YOUR_DROPLET_IP:8000

# AI providers
OPENROUTER_API_KEY=
# Optional cloud STT/TTS fallbacks (not required if using LOCAL only)
DEEPGRAM_API_KEY=
SARVAM_API_KEY=          # if using Sarvam STT/TTS
ELEVENLABS_API_KEY=      # if using ElevenLabs STT/TTS
CARTESIA_API_KEY=        # if using Cartesia TTS

# Optional
DEBUG_AUDIO=false        # Save raw μ-law to debug_audio/
ENABLE_BARGE_IN=true
OPENROUTER_EMBEDDING_MODEL=  # defaults in embeddingService
TEST_PHONE=+1234567890   # for scripts/test-call.js
```

Dashboard (`dashboard/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector
- ngrok (local dev) or public HTTPS/WSS URL (production)
- Twilio account + phone number
- In-house Voice AI server running (Piper + faster-whisper, `VOICE_AI_BASE_URL`)
- API keys: OpenRouter (minimum); Deepgram optional as STT/TTS fallback

### Quick start

```bash
# 1. Install
npm install
cd dashboard && npm install && cd ..

# 2. Configure .env (see above)

# 3. Database
npx prisma migrate deploy
npm run seed          # Creates support agent + assigns TWILIO_NUMBER

# 4. Run backend
npm run dev           # or: npm run build && npm start

# 5. Run dashboard (separate terminal)
cd dashboard && npm run dev   # http://localhost:3001

# 6. Expose backend for Twilio
ngrok http 3000
# Set NGROK_URL=wss://... and PUBLIC_URL=https://... in .env, restart backend

# 7. Configure Twilio phone webhook
# Voice → A CALL COMES IN → Webhook POST → https://<ngrok>/voice
```

Or use `./setup-all.sh` to install and build everything.

### Seed data

`npm run seed` creates:
- Agent `support-agent-1` with default ecommerce support prompt
- Phone number mapping from `TWILIO_NUMBER` env var

---

## Dashboard

Next.js app at `http://localhost:3001`.

| Route | Feature |
|-------|---------|
| `/` | Overview, health, quick stats |
| `/calls/live` | Monitor active calls, hangup |
| `/calls` | Call history |
| `/calls/[id]` | Transcript + call detail |
| `/knowledge` | Upload PDFs, add URLs, attach to agents |
| `/config` | Create/edit agents (LLM, STT, TTS, behavior) |
| `/analytics` | Call analytics |
| `/logs` | System logs viewer |
| `/login` | JWT login |

API client: `dashboard/lib/api.ts` → `BolnaAPI` class.

---

## Development

```bash
npm run dev          # Backend with ts-node
npm run watch        # TypeScript watch compile
npm run build        # Compile to dist/
npm run clean        # Remove dist/
npm run test:call    # Trigger test outbound call
npm run test:agent   # Test agent engine
npm run seed         # Seed database
```

### Adding a new STT provider

1. Create `src/stt/<provider>Stream.ts` implementing transcript callbacks.
2. In `streamHandler.ts`, add provider branch in STT initialization (~line 1386).
3. Add enum value to `SttProvider` in `prisma/schema.prisma` if persisted.

### Adding a new TTS provider

1. Create `src/tts/<provider>TTS.ts` with `speak()`, `abort()`, `clearQueue()`.
2. Add branch in `streamHandler.ts` TTS factory (~line 1404).
3. Expose in dashboard config UI and `Agent.ttsProvider`.

### Adding an API route

1. Add handler in appropriate `*Controller.ts` or inline in `server.ts`.
2. Register route in `server.ts`.
3. Add method to `dashboard/lib/api.ts` if dashboard needs it.

---

## Log Events (grep-friendly)

```
[AGENT_LOADED]        Agent resolved for call
[TRANSCRIPT]          STT result (partial or final)
[KB_RETRIEVAL]        Knowledge docs fetched
[AI_RESPONSE]         LLM response text
[TTS_START]           AI begins speaking
[TTS_END]             AI finished speaking
[BARGE_IN]            User interrupted AI
[TTS_ABORTED]         TTS cancelled
[OUTBOUND_CALL_CONNECTED]
[TWILIO_HANGUP_SUCCESS]
```

Enable debug audio: `DEBUG_AUDIO=true` → saves to `debug_audio/<callSid>.raw`

Convert to WAV:
```bash
sox -t ul -r 8000 -c 1 debug_audio/CAxxxx.raw output.wav
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| WebSocket won't connect | `NGROK_URL` must be `wss://`, not `https://` |
| No agent on call | Run seed; verify `PhoneNumber` maps Twilio `To` number |
| STT silent | `VOICE_AI_BASE_URL` reachable (`curl $VOICE_AI_BASE_URL/health`) for LOCAL, else provider API key; agent `sttProvider`; look for `[TRANSCRIPT]` |
| LLM silent | `OPENROUTER_API_KEY` |
| TTS silent | `VOICE_AI_BASE_URL` reachable for LOCAL, else provider API key; agent `ttsProvider`/`voice`; `[TTS_START]` logs |
| Outbound fails | `PUBLIC_URL`, `TWILIO_*` env vars |
| KB not used | Agent has sources attached via `/agents/:id/knowledge-sources` |
| Dashboard CORS | `DASHBOARD_ORIGIN` matches dashboard URL |

---

## Production Notes

- Use PM2 or similar: `pm2 start dist/server.js --name bolna-backend`
- Health check: `GET /health`
- WebSocket needs sticky sessions behind load balancer
- Validate Twilio request signatures (not yet implemented)
- Rotate API keys regularly
- Use `npm run build` before `npm start`

---

## License

MIT
