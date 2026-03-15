import { config } from 'dotenv';
config();

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { VoiceGateway } from './voiceGateway/gateway';
import { TwiMLController } from './twilio/twimlController';
import { createLogger } from './utils/logger';

const logger = createLogger('Server');

/**
 * Voice AI Platform - Phase 3: LLM Reasoning Layer
 * 
 * This server implements the foundational infrastructure for a production-grade
 * Voice AI system similar to Bolna, Vapi, or Retell.
 * 
 * Phase 3 Scope:
 * - Receive real-time audio from Twilio Media Streams
 * - Parse and decode audio chunks (μ-law → PCM)
 * - Stream audio to Deepgram for real-time transcription
 * - Trigger LLM reasoning on final transcripts
 * - Generate AI responses using OpenRouter
 * - Maintain conversation history per call session
 * 
 * Architecture:
 * 
 * 1. HTTP Server (Express): Serves TwiML webhooks and health checks
 * 2. WebSocket Server (ws): Receives Twilio Media Stream connections
 * 3. Voice Gateway: Orchestrates WebSocket lifecycle
 * 4. Stream Handler: Processes individual call streams
 * 5. Deepgram STT: Converts speech to text
 * 6. OpenRouter LLM: Generates AI responses from transcripts
 * 
 * Pipeline Flow:
 * Twilio Audio → Voice Gateway → Deepgram STT → Transcript Text → LLM → AI Response
 * 
 * Future Phases:
 * - Phase 4: TTS integration (AI voice responses back to caller)
 * - Phase 5: Advanced conversation state management and analytics
 */

const PORT = process.env.PORT || 3000;
const NGROK_URL = process.env.NGROK_URL || 'wss://your-ngrok-url.ngrok-free.app';
const WS_PATH = '/stream';

const app = express();
const server = createServer(app);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/**
 * Initialize core components:
 * 
 * - TwiMLController: Generates TwiML responses for Twilio webhooks
 * - VoiceGateway: Manages WebSocket server and call sessions
 * 
 * The wsUrl must be a wss:// (secure WebSocket) URL for Twilio to connect.
 * In development, ngrok provides a secure tunnel to localhost.
 */
const wsUrl = `${NGROK_URL}${WS_PATH}`;
const twimlController = new TwiMLController(wsUrl);
const voiceGateway = new VoiceGateway(server, WS_PATH);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'running',
    service: 'Voice AI Platform - Phase 3: LLM Reasoning Layer',
    endpoints: {
      voice: '/voice',
      stream: WS_PATH,
      health: '/health',
    },
  });
});

app.post('/voice', (req: Request, res: Response) => {
  twimlController.handleVoiceWebhook(req, res);
});

app.get('/health', (_req: Request, res: Response) => {
  const metrics = voiceGateway.getMetrics();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    ...metrics,
  });
});

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal');
  
  try {
    await voiceGateway.shutdown();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
  logger.info('Voice AI Platform started', {
    port: PORT,
    streamPath: WS_PATH,
    streamUrl: wsUrl,
  });

  logger.info('To connect Twilio:', {
    twimlUrl: `${NGROK_URL}/voice`,
    streamUrl: wsUrl,
  });
});
