import WebSocket from 'ws';
import { createLogger } from '../utils/logger';
import { CallSession } from '../voiceGateway/types';
import * as https from 'https';

const logger = createLogger('DeepgramTTS');

export interface DeepgramTTSConfig {
  apiKey: string;
  model?: string;
  voice?: string;
}

interface TTSQueueItem {
  text: string;
  streamSid: string;
  voice: string;
}

export class DeepgramTTS {
  private config: DeepgramTTSConfig;
  private activeConnections: Map<string, WebSocket> = new Map();
  private processingQueues: Map<string, TTSQueueItem[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private activeRequests: Map<string, any> = new Map();

  constructor(config: DeepgramTTSConfig) {
    this.config = {
      model: 'aura-asteria-en',
      voice: 'aura-asteria-en',
      ...config,
    };
    logger.info('DeepgramTTS initialized', { 
      model: this.config.model,
      voice: this.config.voice,
    });
  }

  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string): Promise<void> {
    const { callSid, streamSid } = session;

    if (!text || !text.trim()) {
      logger.debug('Empty text, skipping TTS', { callSid });
      return;
    }

    const selectedVoice = voice || this.config.voice || 'aura-asteria-en';

    logger.info('[TTS_START]', {
      callSid,
      streamSid,
      text,
      textLength: text.length,
      voice: selectedVoice,
    });

    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    if (!this.processingQueues.has(callSid)) {
      this.processingQueues.set(callSid, []);
    }

    this.processingQueues.get(callSid)!.push({ text, streamSid, voice: selectedVoice });

    if (!this.isProcessing.get(callSid)) {
      this.processQueue(callSid, ws, session);
    }
  }

  private async processQueue(callSid: string, ws: WebSocket, session: CallSession): Promise<void> {
    this.isProcessing.set(callSid, true);

    const queue = this.processingQueues.get(callSid);
    if (!queue || queue.length === 0) {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      return;
    }

    const item = queue.shift()!;

    try {
      await this.streamTextToSpeech(callSid, item.text, item.streamSid, ws, session, item.voice);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[TTS_ABORTED]', { callSid });
      } else {
        logger.error('TTS streaming failed', { callSid, error });
      }
    }

    if (queue.length > 0 && !session.ttsAbortController?.signal.aborted) {
      setImmediate(() => this.processQueue(callSid, ws, session));
    } else {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
    }
  }

  private async streamTextToSpeech(
    callSid: string,
    text: string,
    streamSid: string,
    ws: WebSocket,
    session: CallSession,
    voice: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(`https://api.deepgram.com/v1/speak?model=${voice}&encoding=mulaw&sample_rate=8000&container=none`);
      
      const body = JSON.stringify({ text });

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      logger.debug('Sending TTS request', {
        callSid,
        hostname: options.hostname,
        path: options.path,
        textLength: text.length,
        voice,
      });

      const abortSignal = session.ttsAbortController?.signal;

      const abortHandler = () => {
        logger.info('[TTS_ABORTED]', { callSid });
        req.destroy();
        const error = new Error('TTS aborted');
        error.name = 'AbortError';
        reject(error);
      };

      abortSignal?.addEventListener('abort', abortHandler);

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          abortSignal?.removeEventListener('abort', abortHandler);
          reject(new Error(`Deepgram TTS API error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        let totalChunks = 0;
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          if (abortSignal?.aborted) {
            res.destroy();
            return;
          }

          if (chunk && chunk.length > 0) {
            totalChunks++;
            totalBytes += chunk.length;

            const base64Audio = chunk.toString('base64');

            const mediaMessage = {
              event: 'media',
              streamSid,
              media: {
                payload: base64Audio,
              },
            };

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(mediaMessage));

              logger.debug('[TTS_STREAM]', {
                callSid,
                chunkSize: chunk.length,
                chunkNumber: totalChunks,
              });
            } else {
              logger.warn('WebSocket not open, skipping audio chunk', {
                callSid,
                readyState: ws.readyState,
              });
            }
          }
        });

        res.on('end', () => {
          abortSignal?.removeEventListener('abort', abortHandler);
          
          if (!abortSignal?.aborted) {
            logger.info('[TTS_END]', {
              callSid,
              streamSid,
              totalChunks,
              totalBytes,
            });
            resolve();
          }
        });

        res.on('error', (error) => {
          abortSignal?.removeEventListener('abort', abortHandler);
          logger.error('Response stream error', { callSid, error });
          reject(error);
        });
      });

      this.activeRequests.set(callSid, req);

      req.on('error', (error: any) => {
        abortSignal?.removeEventListener('abort', abortHandler);
        
        if (error.code !== 'ECONNRESET' && !abortSignal?.aborted) {
          logger.error('TTS request failed', { callSid, error });
          reject(error);
        } else {
          resolve();
        }
      });

      req.write(body);
      req.end();
    });
  }

  abort(callSid: string): void {
    logger.info('[TTS_ABORT_REQUESTED]', { callSid });

    const req = this.activeRequests.get(callSid);
    if (req) {
      req.destroy();
      this.activeRequests.delete(callSid);
    }

    this.isProcessing.set(callSid, false);
  }

  clearQueue(callSid: string): void {
    const queue = this.processingQueues.get(callSid);
    if (queue) {
      const clearedCount = queue.length;
      queue.length = 0;
      logger.info('[TTS_QUEUE_CLEARED]', { callSid, clearedCount });
    }
  }

  cleanup(callSid: string): void {
    this.abort(callSid);
    this.clearQueue(callSid);
    this.processingQueues.delete(callSid);
    this.isProcessing.delete(callSid);
    this.activeConnections.delete(callSid);
    this.activeRequests.delete(callSid);
    logger.debug('TTS cleanup completed', { callSid });
  }
}
