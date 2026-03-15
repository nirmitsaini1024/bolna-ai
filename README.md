# Voice AI Platform

Production-grade Voice AI system with real-time speech processing, LLM reasoning, and natural conversation capabilities including barge-in support.

## Current Status: Phase 5 Complete ✅

**Implemented Features:**
- ✅ Phase 1: Voice Gateway (Twilio Media Streams)
- ✅ Phase 2: Speech-to-Text (Deepgram STT)
- ✅ Phase 3: LLM Integration (OpenRouter)
- ✅ Phase 4: Text-to-Speech (Deepgram TTS)
- ✅ **Phase 5: Barge-In Support (NEW)**

## Architecture Overview

This system implements a complete Voice AI platform similar to Bolna, Vapi, or Retell.

### Full Pipeline

```
Caller
  ↓ (speaks)
Twilio Media Streams
  ↓ (WebSocket audio)
Voice Gateway
  ↓ (audio queue)
Deepgram STT
  ↓ (transcripts)
OpenRouter LLM
  ↓ (AI response)
Deepgram TTS
  ↓ (audio stream)
Caller (hears AI)
  ↓ (can interrupt!)
Barge-In Support ← NEW!
```

### How Twilio Media Streams Work

Twilio Media Streams provide real-time access to the raw audio of phone calls:

1. **Call Initiation**: When a call arrives, Twilio requests TwiML instructions from your webhook
2. **Stream Connection**: TwiML `<Connect><Stream>` tells Twilio to establish a WebSocket connection
3. **Bidirectional Audio**: Twilio streams audio chunks (mulaw encoded, 8kHz, 20ms frames) in real-time
4. **Event-Driven**: The gateway receives `start`, `media`, and `stop` events asynchronously

### Why WebSockets?

- **Low Latency**: Sub-100ms bidirectional communication required for natural conversations
- **Full Duplex**: Simultaneous inbound (caller) and outbound (AI agent) audio streams
- **Event-Driven**: Non-blocking architecture supports thousands of concurrent calls
- **Stateful**: Maintains persistent connection per call for the entire session

### Key Features

#### 🎙️ Real-Time Speech Processing
- Deepgram STT with live streaming
- Low-latency transcription (< 1 second)
- Handles 8kHz telephony audio

#### 🤖 LLM Integration
- OpenRouter for flexible model selection
- Conversation history management
- Context-aware responses

#### 🔊 Natural Speech Synthesis
- Deepgram TTS with streaming audio
- Multiple voice options
- Queue management for responses

#### ⚡ Barge-In Support (Phase 5)
- **User can interrupt AI while speaking**
- Immediate TTS cancellation (< 500ms)
- Natural conversation flow
- Per-session isolation for concurrent calls

### System Integration

- **STT Pipeline**: Audio chunks → Speech-to-Text (Deepgram) ✅
- **LLM Pipeline**: Transcribed text → Language Model (OpenRouter) ✅
- **TTS Pipeline**: AI responses → Text-to-Speech (Deepgram) ✅
- **Barge-In**: Interrupt handling and TTS cancellation ✅
- **State Management**: Call context, conversation history, per-session isolation ✅

## Project Structure

```
voice-platform/
├── src/
│   ├── server.ts                    # Main entry point, HTTP + WS server
│   ├── voiceGateway/
│   │   ├── gateway.ts               # WebSocket server orchestrator
│   │   ├── streamHandler.ts        # Twilio Media Stream event processor
│   │   ├── types.ts                 # TypeScript type definitions (with barge-in)
│   │   └── audioQueue.ts            # Audio buffer management
│   ├── stt/
│   │   └── deepgramStream.ts        # Speech-to-Text streaming
│   ├── llm/
│   │   └── openrouterClient.ts      # LLM integration
│   ├── tts/
│   │   └── deepgramTTS.ts           # Text-to-Speech with abort support
│   ├── twilio/
│   │   └── twimlController.ts       # TwiML generation for /voice endpoint
│   └── utils/
│       └── logger.ts                # Structured logging abstraction
├── docs/
│   ├── PHASE5_BARGE_IN.md          # Complete barge-in documentation
│   ├── PHASE5_TESTING_GUIDE.md     # Testing instructions
│   ├── PHASE5_SUMMARY.md           # Implementation summary
│   └── PHASE5_VISUAL_FLOW.md       # Visual diagrams and flows
├── package.json
├── tsconfig.json
└── .env
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```env
PORT=3000
NGROK_URL=wss://your-ngrok-url.ngrok-free.app

# Required for STT
DEEPGRAM_API_KEY=your_deepgram_api_key

# Required for LLM
OPENROUTER_API_KEY=your_openrouter_api_key

# Required for Twilio integration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Optional: Enable debug audio recording
DEBUG_AUDIO=false
```

**Get API Keys:**
- Deepgram: https://console.deepgram.com/
- OpenRouter: https://openrouter.ai/keys
- Twilio: https://console.twilio.com/

### 3. Build the Project

```bash
npm run build
```

### 4. Start the Server

For production:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

You should see:
```
[2026-03-15T...] [INFO] [Server] Voice AI Platform started {"port":3000,"streamPath":"/stream","streamUrl":"wss://..."}
```

### 5. Expose Server with ngrok

In a new terminal:
```bash
ngrok http 3000
```

Copy the forwarding URL (e.g., `https://abc123.ngrok-free.app`)

Update `.env`:
```env
NGROK_URL=wss://abc123.ngrok-free.app
```

Restart the server.

### 6. Configure Twilio Webhook

1. Go to Twilio Console → Phone Numbers
2. Select your Twilio number
3. Under "Voice Configuration":
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://abc123.ngrok-free.app/voice`
   - **HTTP**: POST
4. Save

### 7. Test the System

Make a call to your Twilio number.

**Expected behavior:**
1. AI greets you
2. You can speak and AI responds
3. **You can interrupt AI while it's speaking** (barge-in)
4. Natural back-and-forth conversation

Expected logs:
```
[INFO] [TwiMLController] Incoming voice call {"callSid":"CA...","from":"+1234...","to":"+1567..."}
[INFO] [VoiceGateway] New WebSocket connection {"connectionId":"uuid","activeConnections":1}
[INFO] [StreamHandler] Call stream started {"callSid":"CA...","streamSid":"MZ...","encoding":"audio/x-mulaw","sampleRate":8000}
[DEBUG] [StreamHandler] Audio chunk received {"callSid":"CA...","track":"inbound","sequenceNumber":"1","payloadSize":160}
[INFO] [TRANSCRIPT] {"callSid":"CA...","text":"Hello","isFinal":true}
[INFO] [AI_RESPONSE] {"callSid":"CA...","text":"Hi! How can I help you?"}
[INFO] [TTS_START] {"callSid":"CA..."}
[INFO] [BARGE_IN] {"callSid":"CA...","reason":"user_speech_detected"}
[INFO] [TTS_ABORTED] {"callSid":"CA..."}
[INFO] [TRANSCRIPT] {"callSid":"CA...","text":"Wait, I need help","isFinal":true}
...
[INFO] [StreamHandler] Call stream ended {"callSid":"CA...","duration":"45s"}
```

## API Endpoints

### GET /
Health check and service information

### POST /voice
TwiML webhook that returns stream connection instructions

### GET /health
System health and metrics:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "activeConnections": 5,
  "activeSessions": 5
}
```

### WebSocket /stream
Receives Twilio Media Stream connections (not accessed directly by clients)

## Event Flow

```
Incoming Call
    ↓
POST /voice (HTTP)
    ↓
TwiML Response: <Connect><Stream>
    ↓
WebSocket Connection /stream
    ↓
START event → Initialize session (isSpeaking=false)
    ↓
MEDIA events → Decode audio chunks (20ms μ-law)
    ↓         ↓
    ↓         └→ Barge-in Detection (if isSpeaking=true)
    ↓                ↓
    ↓                └→ Abort TTS, Clear Queue
    ↓
Audio Queue → Deepgram STT
    ↓
Transcripts → OpenRouter LLM
    ↓
AI Response → Deepgram TTS (isSpeaking=true)
    ↓
Audio Stream → Back to Caller
    ↓
STOP event → Cleanup session
```

## Audio Format

- **Encoding**: μ-law (G.711)
- **Sample Rate**: 8000 Hz
- **Channels**: 1 (mono)
- **Chunk Size**: ~160 bytes (20ms of audio)
- **Base64 Encoded**: Decoded to Buffer in streamHandler

## Scalability Considerations

This architecture is designed for production scale:

- **Event-Driven**: Non-blocking I/O supports high concurrency
- **Stateless HTTP**: TwiML endpoint scales horizontally
- **Stateful WebSocket**: Session management isolated per connection
- **Memory Efficient**: Streaming processing with proper cleanup
- **Graceful Shutdown**: Proper cleanup of active sessions
- **Barge-In Isolation**: Per-session abort controllers prevent cross-talk
- **Concurrent Calls**: Multiple calls handled independently

## Phase 5: Barge-In Support 🎯

### What is Barge-In?

Barge-in allows users to interrupt the AI while it's speaking, creating natural conversation flow like human-to-human interaction.

### Implementation

**Key Components:**
- `CallSession.isSpeaking` - Tracks AI speaking state
- `CallSession.ttsAbortController` - Cancels TTS immediately
- `DeepgramTTS.abort()` - Stops current audio stream
- `DeepgramTTS.clearQueue()` - Removes pending responses
- `StreamHandler.handleBargeIn()` - Interruption logic

**How It Works:**
1. User speaks while AI is talking
2. System detects audio during `isSpeaking=true`
3. Aborts TTS via `AbortController`
4. Clears TTS queue
5. Processes new user input
6. Generates new AI response

**Performance:**
- Barge-in detection: < 50ms
- TTS abort: < 100ms
- Total interruption: < 500ms

**Documentation:**
- Complete docs: `PHASE5_BARGE_IN.md`
- Testing guide: `PHASE5_TESTING_GUIDE.md`
- Visual flows: `PHASE5_VISUAL_FLOW.md`
- Summary: `PHASE5_SUMMARY.md`

## Next Steps (Future Enhancements)

### Phase 5.1: Enhanced Voice Activity Detection
- Audio energy-based detection
- Filter background noise
- Configurable sensitivity levels

### Phase 6: Advanced Features
- Call analytics and monitoring
- Redis for distributed session management
- Rate limiting and authentication
- Multiple language support
- Custom voice training

### Phase 7: Enterprise Features
- Call recording and playback
- Real-time transcription dashboard
- A/B testing for AI personalities
- Sentiment analysis
- Call routing and transfer

## Development

Watch mode (auto-rebuild on changes):
```bash
npm run watch
```

Clean build artifacts:
```bash
npm run clean
```

## Troubleshooting

### WebSocket Issues

**WebSocket not connecting:**
- Verify ngrok URL uses `wss://` protocol
- Check ngrok is running and forwarding to correct port
- Ensure NGROK_URL in .env matches actual ngrok URL

**No audio chunks received:**
- Verify Twilio webhook is configured correctly
- Check server logs for connection establishment
- Ensure call actually connected (not voicemail/busy)

### Speech Processing Issues

**STT not transcribing:**
- Verify `DEEPGRAM_API_KEY` is set correctly
- Check Deepgram account has credits
- Look for `[TRANSCRIPT]` logs
- Ensure audio quality is good (speak clearly)

**LLM not responding:**
- Verify `OPENROUTER_API_KEY` is set correctly
- Check OpenRouter account has credits
- Look for `[AI_RESPONSE]` logs
- Check rate limits

**TTS not playing:**
- Verify `DEEPGRAM_API_KEY` is set correctly
- Check Deepgram TTS is enabled on account
- Look for `[TTS_START]` and `[TTS_END]` logs
- Verify WebSocket is still open

### Barge-In Issues

**AI doesn't stop when interrupted:**
- Check `isSpeaking` flag is set to `true`
- Verify `[BARGE_IN]` log appears
- Check `ttsAbortController` exists
- Look for `[TTS_ABORTED]` log

**Too sensitive (interrupts on background noise):**
- Expected behavior in Phase 5 (any audio triggers)
- Future: Will add energy-based detection
- Workaround: Use quieter environment

**TTS doesn't resume after interruption:**
- Check STT continues processing (`[TRANSCRIPT]` logs)
- Verify LLM generates response (`[AI_RESPONSE]` logs)
- Ensure `isSpeaking` reset to `false`

### Debug Mode

Enable detailed logging:
```env
DEBUG_AUDIO=true
```

This will:
- Save raw audio to `debug_audio/` folder
- Add verbose logging
- Help diagnose audio issues

Convert debug audio to WAV:
```bash
sox -t ul -r 8000 -c 1 debug_audio/CAxxxx.raw output.wav
```

### Build Issues

**Build errors:**
- Run `npm install` to ensure all dependencies installed
- Check TypeScript version: `npx tsc --version`
- Verify Node.js version: `node --version` (requires v16+)
- Run `npm run clean` then `npm run build`

## Monitoring and Logs

### Log Levels

- `INFO`: Important events (calls, transcripts, responses)
- `DEBUG`: Detailed flow (audio chunks, state changes)
- `WARN`: Recoverable issues (queue full, WebSocket errors)
- `ERROR`: Critical failures (API errors, crashes)

### Key Log Events

```
[TRANSCRIPT]          - User speech transcribed
[AI_RESPONSE]         - LLM response generated
[TTS_START]           - AI begins speaking
[TTS_STREAM]          - Audio chunk sent
[TTS_END]             - AI finishes speaking
[BARGE_IN]            - User interrupts AI
[TTS_ABORTED]         - TTS cancelled
[TTS_QUEUE_CLEARED]   - Pending responses removed
```

### Monitor Real-Time

```bash
# All events
tail -f logs/*.log

# Speech processing
tail -f logs/*.log | grep -E "TRANSCRIPT|AI_RESPONSE|TTS"

# Barge-in events
tail -f logs/*.log | grep "BARGE_IN"

# Errors only
tail -f logs/*.log | grep ERROR
```

## Production Deployment

### Recommended Setup

1. **Use a process manager:**
   ```bash
   pm2 start dist/server.js --name voice-ai
   pm2 logs voice-ai
   ```

2. **Set up monitoring:**
   - Use `/health` endpoint for health checks
   - Monitor active sessions count
   - Alert on high error rates

3. **Scale horizontally:**
   - Load balancer for HTTP endpoints
   - WebSocket sticky sessions
   - Future: Redis for session storage

4. **Security:**
   - Use HTTPS/WSS in production
   - Validate Twilio signatures
   - Rate limit webhooks
   - Rotate API keys regularly

### Performance Tuning

**Expected Latencies:**
- End-to-end (user speaks → AI responds): 2-4 seconds
- STT transcription: 500-1000ms
- LLM response: 500-1500ms
- TTS generation: 500-1000ms
- Barge-in interruption: < 500ms

**Optimization Tips:**
- Use faster LLM models (gpt-4o-mini vs gpt-4)
- Enable streaming for STT and TTS
- Pre-warm connections
- Use CDN for static assets

## License

MIT

## Support

For issues, questions, or contributions:
- Read documentation in `/docs`
- Check troubleshooting section
- Review logs for error messages
- Test with `PHASE5_TESTING_GUIDE.md`
