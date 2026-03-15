# Bolna Dashboard - Quick Start Guide

## Overview

The Bolna Dashboard is a modern web interface for monitoring and managing your Voice AI Platform. It provides real-time insights, call tracking, performance analytics, and configuration management.

## Structure

```
dashboard/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── calls/page.tsx        # Call history
│   ├── analytics/page.tsx    # Performance analytics
│   ├── logs/page.tsx         # System logs viewer
│   ├── config/page.tsx       # Configuration management
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   └── api.ts                # API client for Bolna backend
├── public/                   # Static assets
├── .env.local                # Environment variables
└── package.json              # Dependencies

```

## Features

### 1. Dashboard (/)
- **Real-time System Status**: Monitor health, uptime, connections, and active sessions
- **Feature Status**: View status of Voice Gateway, STT, LLM, TTS, and Barge-In
- **Quick Actions**: Test calls, view logs, manage configuration
- **Architecture Visualization**: See the complete pipeline flow

### 2. Calls (/calls)
- **Call History**: View all calls with details (Call SID, from/to numbers, status, duration)
- **Statistics**: Total calls, average duration, success rate
- **Export**: Export call data to CSV
- **Filtering**: Filter by status (completed, in-progress, failed)

### 3. Analytics (/analytics)
- **Performance Metrics**: Monitor STT, LLM, and TTS latencies
- **Hourly Distribution**: Visualize call volume by hour
- **API Usage**: Track Deepgram and OpenRouter usage
- **Call Distribution**: See breakdown by status
- **System Health**: Monitor CPU, memory, network, and disk I/O

### 4. Logs (/logs)
- **Real-time Log Viewer**: Monitor system events as they happen
- **Filtering**: Filter by log level (INFO, DEBUG, WARN, ERROR)
- **Auto-scroll**: Option to auto-scroll to latest logs
- **Event Details**: View full event data in JSON format
- **Statistics**: Track total events, errors, and warnings

### 5. Configuration (/config)
- **API Key Management**: Securely manage all API keys
- **Environment Settings**: Configure Twilio, Deepgram, OpenRouter
- **Quick Tests**: Test API connections directly from the UI
- **System Information**: View Node version, platform, database status

## Running the Dashboard

### Development Mode

```bash
cd dashboard
npm run dev
```

The dashboard will be available at `http://localhost:3001`

### Production Build

```bash
cd dashboard
npm run build
npm run start
```

## Configuration

### Environment Variables

Create or edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

This should point to your Bolna Voice AI Platform backend.

## Design & Styling

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS 4
- **Theme**: Dark mode with purple-to-pink gradients
- **Responsive**: Mobile-friendly design
- **Typography**: Geist Sans and Geist Mono fonts

## API Integration

The dashboard communicates with the Bolna backend via REST API:

- `GET /health` - System health and metrics
- `GET /` - Service information

Future integrations:
- WebSocket for real-time log streaming
- Call history from database
- Configuration updates

## Deployment

### Vercel (Recommended)

```bash
cd dashboard
vercel
```

### Docker

```bash
cd dashboard
docker build -t bolna-dashboard .
docker run -p 3001:3001 -e NEXT_PUBLIC_API_URL=http://your-api bolna-dashboard
```

### Traditional Hosting

```bash
cd dashboard
npm run build
# Serve the .next directory with your preferred static hosting
```

## Development Tips

1. **Hot Reload**: Changes to components automatically reload in dev mode
2. **Type Safety**: Full TypeScript support with strict mode
3. **Component Structure**: Each page is self-contained for easy modification
4. **Mock Data**: Currently uses mock data for calls, logs, and analytics
5. **API Client**: Use `lib/api.ts` to add new API endpoints

## Customization

### Colors
Edit Tailwind classes throughout the components:
- Purple: `from-purple-500 to-pink-500`
- Blue: `from-blue-500 to-cyan-500`
- Green: `from-green-500 to-emerald-500`

### Layout
All pages share a common navigation structure that can be modified in each page's nav section.

### Adding New Pages
1. Create `app/newpage/page.tsx`
2. Add navigation link in existing pages
3. Follow existing pattern for consistency

## Troubleshooting

### Build Errors
```bash
cd dashboard
rm -rf .next node_modules
npm install
npm run build
```

### Port Conflicts
Change port in `package.json`:
```json
"dev": "next dev -p 3002"
```

### API Connection Issues
- Ensure Bolna backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings on backend

## Next Steps

1. **Real-time Updates**: Add WebSocket support for live data
2. **Database Integration**: Connect to PostgreSQL for call history
3. **Authentication**: Add user login and role-based access
4. **Advanced Analytics**: Charts using Chart.js or Recharts
5. **Notifications**: Real-time alerts for errors and warnings

## Support

For issues or questions:
- Check the main Bolna README
- Review the API documentation
- Test the backend `/health` endpoint first
