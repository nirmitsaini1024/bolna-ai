import { config } from 'dotenv';
// In dev it's common to have old exported env vars in the shell.
// We want the checked-in `.env` to be the source of truth for local runs.
config({ override: true });

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { VoiceGateway } from './voiceGateway/gateway';
import { TwiMLController } from './twilio/twimlController';
import { createLogger } from './utils/logger';
import { KnowledgeService } from './knowledge/knowledgeService';
import { AuthController } from './auth/authController';
import { jwtMiddleware, AuthenticatedRequest } from './auth/jwtMiddleware';
import { BillingService } from './billing/billingService';
import { AgentController } from './agents/agentController';
import { OutboundController } from './outbound/outboundController';
import multer from 'multer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CallService } from './analytics/callService';
import { MessageService } from './analytics/messageService';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

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

app.use(
  cors({
    origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:3001',
  })
);

const knowledgeService = new KnowledgeService();
const authController = new AuthController();
const billingService = new BillingService();
const agentController = new AgentController();
const callService = new CallService();
const messageService = new MessageService();
const upload = multer({ storage: multer.memoryStorage() });
const prismaPool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prismaAdapter = new PrismaPg(prismaPool as any);
const prisma = new PrismaClient({ adapter: prismaAdapter });

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
const outboundController = new OutboundController();
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

app.post('/auth/register', async (req: Request, res: Response) => {
  await authController.register(req, res);
});

app.post('/auth/login', async (req: Request, res: Response) => {
  await authController.login(req, res);
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

app.get('/agents', async (req: Request, res: Response) => {
  await agentController.listAgents(req, res);
});

app.post('/agents', async (req: Request, res: Response) => {
  await agentController.createAgent(req, res);
});

app.put('/agents/:id', async (req: Request, res: Response) => {
  await agentController.updateAgent(req, res);
});

app.delete('/agents/:id', async (req: Request, res: Response) => {
  await agentController.deleteAgent(req, res);
});

app.post('/outbound/call', async (req: Request, res: Response) => {
  await outboundController.createOutboundCall(req, res);
});

app.post('/call', async (req: Request, res: Response) => {
  const { to, agentId } = req.body as { to?: string; agentId?: string };

  if (!to || !agentId) {
    res.status(400).json({ error: 'to and agentId are required' });
    return;
  }

  // Reuse outbound controller logic by adapting the payload shape
  (req as any).body = { phone: to, agentId };
  await outboundController.createOutboundCall(req, res);
});

app.post('/agents/:agentId/knowledge', jwtMiddleware, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    // In a full implementation, verify that the agent belongs to user.organizationId here.
    const document = await knowledgeService.addDocument(agentId, content);
    res.status(201).json({ id: document.id });
  } catch (error) {
    logger.error('Failed to add knowledge document', error);
    res.status(500).json({ error: 'Failed to add knowledge document' });
  }
});

function splitText(text: string, chunkSize = 700): string[] {
  const chunks: string[] = [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < normalized.length; i += chunkSize) {
    chunks.push(normalized.slice(i, i + chunkSize));
  }
  return chunks;
}

async function extractTextFromHtml(url: string): Promise<string> {
  const response = await axios.get(url, { timeout: 8000 });
  const $ = cheerio.load(response.data);
  const text = $('body').text();
  return text.replace(/\s+/g, ' ').trim();
}

app.post(
  '/knowledge/upload',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined;
    const agentId = (req.body?.agentId as string | undefined)?.trim() || null;

    if (!file) {
      res.status(400).json({ success: false, error: 'file is required' });
      return;
    }

    if (file.mimetype !== 'application/pdf') {
      res.status(400).json({ success: false, error: 'Only PDF files are supported' });
      return;
    }

    try {
      logger.info('[KNOWLEDGE_UPLOAD_START]', {
        agentId: agentId ?? undefined,
        fileName: file.originalname,
        size: file.size,
      });

      const parser = new PDFParse({ data: file.buffer });
      const pdfData = await parser.getText();
      const rawText = (pdfData?.text ?? '') as string;
      const text = rawText.trim();

      logger.info('[PDF_PARSED]', {
        characters: text.length,
      });

      if (!text || text.length < 50) {
        logger.warn('[PDF_NO_TEXT]', {
          fileName: file.originalname,
          size: file.size,
          textLength: text.length,
        });

        res.status(400).json({
          success: false,
          error: 'PDF contains no extractable text',
          reason: 'PDF may be scanned, image-based, or encrypted',
        });
        return;
      }

      const chunks = splitText(text, 700);

      logger.info('[PDF_CHUNKING]', {
        chunks: chunks.length,
      });

      const source = await knowledgeService.addSource({
        type: 'PDF',
        title: file.originalname,
        url: null,
      });

      for (const chunk of chunks) {
        try {
          await knowledgeService.addChunk({ agentId, sourceId: source.id, content: chunk });
        } catch (error) {
          const err = error as any;
          logger.warn('[KB_CHUNK_FAILED]', {
            agentId: agentId ?? undefined,
            sourceId: source.id,
            message: err?.message,
          });
        }
      }

      res.status(201).json({ success: true, uploadedChunks: chunks.length, sourceId: source.id });
    } catch (error) {
      const err = error as any;
      logger.error('[KNOWLEDGE_UPLOAD_FAILED]', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });

      res.status(400).json({
        success: false,
        error: 'Failed to extract text from PDF',
        reason: err?.message ?? 'Unknown PDF parsing error',
      });
    }
  }
);

app.post('/knowledge/url', async (req: Request, res: Response): Promise<void> => {
  const { url, agentId } = req.body as { url?: string; agentId?: string };
  const agentIdOrNull = agentId?.trim() || null;

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    logger.info('[KNOWLEDGE_URL_UPLOAD]', { agentId: agentIdOrNull ?? undefined, url });

    const text = await extractTextFromHtml(url);

    if (!text) {
      res.status(400).json({ error: 'URL appears to have no extractable text' });
      return;
    }

    const chunks = splitText(text, 700);

    const title = (() => {
      try {
        const u = new URL(url);
        return u.hostname || url;
      } catch {
        return url;
      }
    })();

    const source = await knowledgeService.addSource({
      type: 'URL',
      title,
      url,
    });

    for (const chunk of chunks) {
      try {
        await knowledgeService.addChunk({ agentId: agentIdOrNull, sourceId: source.id, content: chunk });
      } catch (error) {
        logger.error('Failed to index URL knowledge chunk', {
          agentId: agentIdOrNull ?? undefined,
          url,
          error,
        });
      }
    }

    res.status(201).json({ uploadedChunks: chunks.length, sourceId: source.id });
  } catch (error) {
    logger.error('Knowledge URL ingestion failed', { url, error });
    res.status(500).json({ error: 'Failed to fetch or process URL' });
  }
});

app.get('/knowledge/source', async (_req: Request, res: Response) => {
  try {
    const sources = await knowledgeService.listSources();
    res.json(
      sources.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    logger.error('Failed to list knowledge sources', { error });
    res.status(500).json({ error: 'Failed to list knowledge sources' });
  }
});

app.delete('/knowledge/source/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    await knowledgeService.deleteSource(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete knowledge source', { sourceId: id, error });
    res.status(500).json({ error: 'Failed to delete knowledge source' });
  }
});

app.get('/agents/:id/knowledge-sources', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const rows = await prisma.agentKnowledgeSource.findMany({
      where: { agentId: id },
      select: { sourceId: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ sourceIds: rows.map((r) => r.sourceId) });
  } catch (error) {
    logger.error('Failed to list agent knowledge sources', { agentId: id, error });
    res.status(500).json({ error: 'Failed to list agent knowledge sources' });
  }
});

app.put('/agents/:id/knowledge-sources', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sourceIds } = req.body as { sourceIds?: string[] };

  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  if (!Array.isArray(sourceIds)) {
    res.status(400).json({ error: 'sourceIds must be an array' });
    return;
  }

  const unique = Array.from(new Set(sourceIds.filter((s) => typeof s === 'string' && s.trim()))).map((s) =>
    s.trim()
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.agentKnowledgeSource.deleteMany({ where: { agentId: id } });
      if (unique.length > 0) {
        await tx.agentKnowledgeSource.createMany({
          data: unique.map((sourceId) => ({ id: crypto.randomUUID(), agentId: id, sourceId })),
          skipDuplicates: true,
        });
      }
    });

    res.json({ success: true, sourceIds: unique });
  } catch (error) {
    logger.error('Failed to update agent knowledge sources', { agentId: id, error });
    res.status(500).json({ error: 'Failed to update agent knowledge sources' });
  }
});

app.get('/billing/usage', jwtMiddleware, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const summary = await billingService.getOrganizationUsage(user.organizationId);
    res.json(summary);
  } catch (error) {
    logger.error('Failed to fetch usage summary', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

app.get('/calls', async (req: Request, res: Response) => {
  try {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const calls = await callService.listCalls({ limit });
    res.json(
      calls.map((c) => ({
        ...c,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt ? c.endedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    logger.error('Failed to list calls', { error });
    res.status(500).json({ error: 'Failed to list calls' });
  }
});

app.get('/calls/:id/messages', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const messages = await messageService.listMessagesByCallId(id);
    res.json(
      messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    logger.error('Failed to fetch call messages', { callId: id, error });
    res.status(500).json({ error: 'Failed to fetch call messages' });
  }
});

app.get('/calls/active', async (_req: Request, res: Response) => {
  try {
    const activeSessions = voiceGateway.getActiveSessionsData();
    res.json(activeSessions);
  } catch (error) {
    logger.error('Failed to fetch active sessions', { error });
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

app.post('/calls/:callSid/hangup', async (req: Request, res: Response) => {
  const { callSid } = req.params;

  if (!callSid) {
    res.status(400).json({ error: 'callSid is required' });
    return;
  }

  try {
    // First, try to end the call via Twilio API
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'Status=completed',
        });

        if (twilioResponse.ok) {
          logger.info('[TWILIO_HANGUP_SUCCESS]', { callSid });
        } else {
          logger.warn('[TWILIO_HANGUP_FAILED]', {
            callSid,
            status: twilioResponse.status,
            statusText: twilioResponse.statusText,
          });
        }
      } catch (twilioError) {
        logger.error('[TWILIO_HANGUP_ERROR]', { callSid, error: twilioError });
      }
    }

    // Also cleanup local session
    const success = await voiceGateway.hangupCall(callSid);

    if (!success) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    res.json({ success: true, message: 'Call hangup initiated' });
  } catch (error) {
    logger.error('Failed to hangup call', { callSid, error });
    res.status(500).json({ error: 'Failed to hangup call' });
  }
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
