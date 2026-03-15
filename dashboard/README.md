# Bolna Dashboard

A modern Next.js dashboard for monitoring and managing the Bolna Voice AI Platform.

## Features

- **Real-time System Monitoring**: View active connections, sessions, and system health
- **Call History**: Track all voice calls with detailed information
- **Performance Analytics**: Monitor STT, LLM, and TTS latencies
- **Beautiful UI**: Modern gradient-based design with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Bolna Voice AI Platform running on port 3000

### Installation

1. Navigate to the dashboard directory:
```bash
cd dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3001](http://localhost:3001) in your browser

## Pages

### Dashboard (`/`)
- System overview with real-time health metrics
- Active connections and sessions counter
- Feature status indicators
- System architecture visualization
- Quick action buttons

### Calls (`/calls`)
- Complete call history with filtering
- Call status tracking (completed, in-progress, failed)
- Duration and timestamp information
- Call statistics and metrics

### Analytics (`/analytics`)
- Hourly call distribution charts
- Performance metrics (STT, LLM, TTS latencies)
- API usage statistics
- Call distribution breakdown
- System resource monitoring

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI**: Custom components with gradient designs

## Development

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run linting
```

## Configuration

The dashboard connects to the Bolna API at the URL specified in `NEXT_PUBLIC_API_URL`. Make sure the main Bolna server is running before starting the dashboard.

## API Endpoints Used

- `GET /health` - System health and metrics
- Future: Additional endpoints for call history, logs, and configuration

## Customization

The dashboard uses a purple-to-pink gradient theme. You can customize colors in the Tailwind classes throughout the components.

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy to Vercel, Netlify, or your preferred hosting:
```bash
npm run start
```

Or deploy to Vercel with one click:
```bash
vercel
```

## Future Enhancements

- Real-time WebSocket updates for live metrics
- Call recording playback
- Transcript viewer
- Configuration management UI
- User authentication
- Advanced filtering and search
- Export functionality for reports
- Dark/light theme toggle
