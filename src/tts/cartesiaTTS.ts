import WebSocket from 'ws';
import * as https from 'https';
import { createLogger } from '../utils/logger';
import { CallSession } from '../voiceGateway/types';

const logger = createLogger('CartesiaTTS');

export interface CartesiaTTSConfig {
  apiKey: string;
  model?: string; // e.g. sonic-3
  versionHeader?: string; // e.g. 2026-03-01
}

interface TTSQueueItem {
  text: string;
  streamSid: string;
  voice: string;
  model?: string;
  language?: string;
}

export class CartesiaTTS {
  private config: CartesiaTTSConfig;
  private processingQueues: Map<string, TTSQueueItem[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private activeRequests: Map<string, any> = new Map();

  constructor(config: CartesiaTTSConfig) {
    this.config = {
      model: 'sonic-3',
      versionHeader: '2026-03-01',
      ...config,
    };

    logger.info('CartesiaTTS initialized', {
      model: this.config.model,
      versionHeader: this.config.versionHeader,
    });
  }

  startStream(session: CallSession): void {
    const { callSid } = session;
    logger.info('[TTS_STREAM_START]', { callSid, provider: 'cartesia' });
    this.clearQueue(callSid);
    this.abort(callSid);
  }

  async sendChunk(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: string): Promise<void> {
    await this.speak(session, text, ws, voice, model);
  }

  endStream(session: CallSession): void {
    logger.info('[TTS_STREAM_END]', { callSid: session.callSid, provider: 'cartesia' });
  }

  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: string): Promise<void> {
    const { callSid, streamSid } = session;
    if (!text || !text.trim()) return;

    const selectedVoice = voice || session.agent?.voice || '';
    if (!selectedVoice) {
      throw new Error('Cartesia TTS requires agent.voice to be set to a Cartesia voice id');
    }

    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    if (!this.processingQueues.has(callSid)) this.processingQueues.set(callSid, []);
    this.processingQueues.get(callSid)!.push({
      text,
      streamSid,
      voice: selectedVoice,
      model: model || this.config.model,
      language: session.agent?.language ?? undefined,
    });

    if (!this.isProcessing.get(callSid)) this.processQueue(callSid, ws, session);
  }

  private async processQueue(callSid: string, ws: WebSocket, session: CallSession): Promise<void> {
    this.isProcessing.set(callSid, true);
    const queue = this.processingQueues.get(callSid);
    if (!queue || queue.length === 0) {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[CARTESIA_TTS_QUEUE_EMPTY_READY_FOR_USER]', { callSid });
      return;
    }

    const item = queue.shift()!;
    try {
      await this.requestAndStream(callSid, item.text, item.streamSid, ws, session, item.voice, item.model, item.language);
    } catch (error: any) {
      if (error?.name === 'AbortError') logger.info('[TTS_ABORTED]', { callSid });
      else logger.error('Cartesia TTS failed', { callSid, error });
    }

    if (queue.length > 0 && !session.ttsAbortController?.signal.aborted) {
      setImmediate(() => this.processQueue(callSid, ws, session));
    } else {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[CARTESIA_TTS_COMPLETE_READY_FOR_USER]', { callSid });
    }
  }

  private async requestAndStream(
    callSid: string,
    text: string,
    streamSid: string,
    ws: WebSocket,
    session: CallSession,
    voiceId: string,
    modelId?: string,
    language?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('https://api.cartesia.ai/tts/bytes');

      const body = JSON.stringify({
        model_id: modelId || this.config.model || 'sonic-3',
        transcript: text,
        voice: { mode: 'id', id: voiceId },
        language: language ? language.slice(0, 2) : undefined,
        output_format: {
          container: 'raw',
          encoding: 'pcm_mulaw',
          sample_rate: 8000,
        },
        generation_config: {
          speed: session.agent?.speechRate ?? 1,
        },
      });

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Cartesia-Version': this.config.versionHeader || '2026-03-01',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const abortSignal = session.ttsAbortController?.signal;
      const abortHandler = () => {
        req.destroy();
        const err = new Error('TTS aborted');
        err.name = 'AbortError';
        reject(err);
      };
      abortSignal?.addEventListener('abort', abortHandler);

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          abortSignal?.removeEventListener('abort', abortHandler);
          reject(new Error(`Cartesia TTS API error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        res.on('data', (chunk: Buffer) => {
          if (abortSignal?.aborted) {
            res.destroy();
            return;
          }
          if (!chunk || chunk.length === 0) return;

          const seconds = chunk.length / 8000;
          session.ttsSeconds = (session.ttsSeconds || 0) + seconds;

          const mediaMessage = {
            event: 'media',
            streamSid,
            media: {
              payload: chunk.toString('base64'),
            },
          };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(mediaMessage));
          }
        });

        res.on('end', () => {
          abortSignal?.removeEventListener('abort', abortHandler);
          resolve();
        });

        res.on('error', (error) => {
          abortSignal?.removeEventListener('abort', abortHandler);
          reject(error);
        });
      });

      this.activeRequests.set(callSid, req);

      req.on('error', (error: any) => {
        abortSignal?.removeEventListener('abort', abortHandler);
        if (error?.code !== 'ECONNRESET' && !abortSignal?.aborted) reject(error);
        else resolve();
      });

      req.write(body);
      req.end();
    });
  }

  abort(callSid: string): void {
    const req = this.activeRequests.get(callSid);
    if (req) {
      req.destroy();
      this.activeRequests.delete(callSid);
    }
    this.isProcessing.set(callSid, false);
  }

  clearQueue(callSid: string): void {
    const q = this.processingQueues.get(callSid);
    if (q) q.length = 0;
  }

  cleanup(callSid: string): void {
    this.abort(callSid);
    this.clearQueue(callSid);
    this.processingQueues.delete(callSid);
    this.isProcessing.delete(callSid);
    this.activeRequests.delete(callSid);
  }
}

