# Bolna Voice AI Platform - Complete Setup

## Project Structure

```
bolna/
├── src/                          # Backend Voice AI Platform
│   ├── server.ts                 # Main server entry
│   ├── voiceGateway/             # WebSocket gateway
│   ├── stt/                      # Speech-to-Text (Deepgram)
│   ├── llm/                      # LLM integration (OpenRouter)
│   ├── tts/                      # Text-to-Speech (Deepgram)
│   └── twilio/                   # Twilio integration
├── dashboard/                    # Next.js Dashboard (NEW)
│   ├── app/
│   │   ├── page.tsx              # Main dashboard
│   │   ├── calls/                # Call history page
│   │   ├── analytics/            # Analytics page
│   │   ├── logs/                 # Logs viewer page
│   │   └── config/               # Configuration page
│   ├── lib/
│   │   └── api.ts                # API client
│   └── README.md
├── prisma/                       # Database schema
├── .env                          # Backend environment variables
└── package.json                  # Backend dependencies
```

## Complete Setup Guide

### 1. Backend Setup

#### Install Dependencies
```bash
npm install
```

#### Configure Environment
Edit `.env`:
```env
PORT=3000
NGROK_URL=wss://your-ngrok-url.ngrok-free.app

DEEPGRAM_API_KEY=your_deepgram_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_NUMBER=your_twilio_phone_number

DATABASE_URL=your_postgresql_connection_string

DEBUG_AUDIO=false
```

#### Start Backend
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The backend will run on `http://localhost:3000`

### 2. Dashboard Setup

#### Navigate to Dashboard
```bash
cd dashboard
```

#### Install Dependencies
```bash
npm install
```

#### Configure Environment
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

#### Start Dashboard
```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

The dashboard will run on `http://localhost:3001`

### 3. Expose with Ngrok

In a separate terminal:
```bash
ngrok http 3000
```

Copy the forwarding URL (e.g., `https://abc123.ngrok-free.app`) and update `NGROK_URL` in `.env` with the WebSocket protocol:
```env
NGROK_URL=wss://abc123.ngrok-free.app
```

Restart the backend after updating.

### 4. Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers
2. Select your Twilio number
3. Under "Voice Configuration":
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok-free.app/voice`
   - **HTTP**: POST
4. Save

## Running Both Services

### Option 1: Separate Terminals

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Dashboard:**
```bash
cd dashboard && npm run dev
```

**Terminal 3 - Ngrok:**
```bash
ngrok http 3000
```

### Option 2: Process Manager (Production)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start dist/server.js --name bolna-backend

# Start dashboard
cd dashboard
pm2 start npm --name bolna-dashboard -- start

# View logs
pm2 logs
```

## Dashboard Features

### Main Dashboard (http://localhost:3001)
- Real-time system status
- Active connections and sessions
- Feature status indicators
- System architecture visualization
- Quick action buttons

### Call History (/calls)
- Complete call records
- Call status tracking
- Duration and timestamps
- Success rate metrics
- Export functionality

### Analytics (/analytics)
- Performance metrics (STT, LLM, TTS latencies)
- Hourly call distribution
- API usage statistics
- Call distribution breakdown
- System resource monitoring

### Logs (/logs)
- Real-time log viewer
- Filter by level (INFO, DEBUG, WARN, ERROR)
- Event details with JSON data
- Auto-scroll option
- Event statistics

### Configuration (/config)
- API key management
- Environment settings
- Connection testing
- System information

## API Endpoints

### Backend (Port 3000)

- `GET /` - Service information
- `POST /voice` - Twilio webhook (TwiML)
- `GET /health` - System health and metrics
- `WebSocket /stream` - Twilio Media Streams

### Dashboard (Port 3001)

- Web UI for monitoring and management
- Static pages with API integration
- Real-time data fetching

## Testing the System

### 1. Check Backend Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 120,
  "activeConnections": 0,
  "activeSessions": 0
}
```

### 2. Access Dashboard

Open `http://localhost:3001` in your browser

### 3. Make a Test Call

Call your Twilio number. Expected flow:
1. AI greets you
2. You can speak
3. AI responds
4. You can interrupt AI (barge-in)
5. Natural conversation

### 4. Monitor in Dashboard

Watch the dashboard for:
- Active connections increase
- System logs appear
- Call appears in call history

## Architecture Overview

```
Phone Call
    ↓
Twilio Media Streams
    ↓
WebSocket (:3000/stream)
    ↓
Voice Gateway
    ↓
┌─────────────┬──────────────┬─────────────┐
│   Deepgram  │  OpenRouter  │  Deepgram   │
│     STT     │     LLM      │     TTS     │
└─────────────┴──────────────┴─────────────┘
    ↓
Response to Caller
    ↓
Dashboard Monitoring (:3001)
```

## Key Features

✅ **Voice Gateway**: Twilio Media Streams integration
✅ **Speech-to-Text**: Deepgram live streaming
✅ **LLM Integration**: OpenRouter for AI responses
✅ **Text-to-Speech**: Deepgram audio synthesis
✅ **Barge-In Support**: User can interrupt AI
✅ **Real-time Dashboard**: Modern web UI
✅ **Call History**: Track all calls
✅ **Analytics**: Performance metrics
✅ **Logs Viewer**: Real-time system logs
✅ **Configuration**: Manage API keys

## Technology Stack

### Backend
- Node.js + TypeScript
- Express.js (HTTP server)
- ws (WebSocket server)
- Deepgram SDK (STT/TTS)
- OpenRouter API (LLM)
- Twilio SDK
- Prisma (Database ORM)
- PostgreSQL (Database)

### Dashboard
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Modern gradient UI

## Performance Metrics

- End-to-end latency: 2-4 seconds
- STT latency: 500-1000ms
- LLM response: 500-1500ms
- TTS generation: 500-1000ms
- Barge-in interruption: < 500ms

## Production Deployment

### Backend
- Deploy to VPS, AWS EC2, or similar
- Use PM2 for process management
- Set up SSL/TLS certificates
- Use permanent tunneling solution (not ngrok for production)
- Configure rate limiting and security

### Dashboard
- Deploy to Vercel (recommended)
- Or build and serve statically
- Configure environment variables
- Enable analytics and monitoring

## Security Considerations

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Rotate API keys regularly**
3. **Use HTTPS/WSS in production**
4. **Validate Twilio webhook signatures**
5. **Implement rate limiting**
6. **Add authentication to dashboard**
7. **Use environment-specific configurations**

## Troubleshooting

### Backend Not Starting
- Check if port 3000 is available
- Verify all environment variables are set
- Check database connection
- Review logs for errors

### Dashboard Not Loading
- Ensure backend is running first
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify port 3001 is available
- Clear Next.js cache: `rm -rf .next`

### No Audio in Calls
- Verify Twilio webhook is configured
- Check ngrok is running and URL is correct
- Ensure Deepgram API key is valid
- Review logs for TTS errors

### Barge-In Not Working
- Check `isSpeaking` flag in logs
- Verify barge-in detection is enabled
- Look for `BARGE_IN` and `TTS_ABORTED` logs

## Documentation

- **Backend**: See main `README.md`
- **Dashboard**: See `dashboard/README.md`
- **Quick Start**: See `dashboard/QUICK_START.md`
- **Phase Docs**: See `PHASE*.md` files

## Next Steps

1. **Database Integration**: Connect dashboard to PostgreSQL for real call data
2. **WebSocket Updates**: Real-time data push to dashboard
3. **Authentication**: Add user login system
4. **Advanced Charts**: Integrate charting library
5. **Call Recording**: Store and playback recordings
6. **Multi-language Support**: Add i18n
7. **Custom Voices**: Train custom TTS voices
8. **Analytics Export**: CSV/PDF reports

## Support & Resources

- **Deepgram**: https://console.deepgram.com/
- **OpenRouter**: https://openrouter.ai/
- **Twilio**: https://console.twilio.com/
- **Next.js**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

## License

MIT
