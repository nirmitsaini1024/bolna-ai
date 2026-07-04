import WebSocket from 'ws';
import * as http from 'http';
import * as https from 'https';
import { createLogger } from '../utils/logger';
import { CallSession } from '../voiceGateway/types';
import { wavToMulaw8k } from '../utils/audioConvert';

const logger = createLogger('LocalTTS');

export interface LocalTTSConfig {
  baseUrl: string; // e.g. http://DROPLET_IP:8000
  defaultVoice?: string; // Piper alias or full model name, default 'male1'
}

interface TTSQueueItem {
  text: string;
  streamSid: string;
  voice: string;
}

/** Piper voice aliases served by the in-house voice server. */
const PIPER_VOICES = new Set(['male1', 'male2', 'female1', 'female2']);

/**
 * Verify the in-house voice server is reachable (GET /health → 200).
 * Used at provider-selection time so callers can fall back to a cloud
 * provider with a clear warning instead of failing mid-call.
 */
export function checkLocalVoiceServerHealth(baseUrl: string, timeoutMs: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL('/health', baseUrl);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.get(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`Local voice server health check failed: ${res.statusCode}`));
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Local voice server health check timeout'));
    });
    req.on('error', (error) => reject(error));
  });
}

/**
 * LocalTTS speaks via the self-hosted Piper voice server:
 * POST {baseUrl}/tts {text, voice} → WAV (PCM16, typically 22050 Hz)
 * → converted to μ-law 8 kHz in-process → streamed to Twilio in 160-byte frames.
 *
 * Queue/abort/cleanup semantics mirror DeepgramTTS/SarvamTTS.
 */
export class LocalTTS {
  private config: LocalTTSConfig;
  private processingQueues: Map<string, TTSQueueItem[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private activeRequests: Map<string, any> = new Map();

  constructor(config: LocalTTSConfig) {
    this.config = {
      defaultVoice: 'male1',
      ...config,
    };
    logger.info('LocalTTS initialized', {
      baseUrl: this.config.baseUrl,
      defaultVoice: this.config.defaultVoice,
    });
  }

  startStream(session: CallSession): void {
    const { callSid } = session;
    logger.info('[TTS_STREAM_START]', { callSid, provider: 'local' });
    this.clearQueue(callSid);
    this.abort(callSid);
  }

  async sendChunk(session: CallSession, text: string, ws: WebSocket, voice?: string, _model?: string): Promise<void> {
    await this.speak(session, text, ws, voice);
  }

  endStream(session: CallSession): void {
    logger.info('[TTS_STREAM_END]', { callSid: session.callSid, provider: 'local' });
  }

  /**
   * Resolve the requested voice to something the Piper server understands.
   * Agents configured for cloud providers may carry voices like
   * 'aura-asteria-en' — map anything non-Piper-looking to the default alias.
   */
  private resolveVoice(voice?: string): string {
    const candidate = (voice || '').trim();
    if (!candidate) return this.config.defaultVoice || 'male1';
    if (PIPER_VOICES.has(candidate)) return candidate;
    // Full/partial Piper model names look like en_US-lessac-medium.
    if (/^[a-z]{2}_[A-Z]{2}-/.test(candidate)) return candidate;
    logger.debug('Non-Piper voice requested, using default', { requested: candidate });
    return this.config.defaultVoice || 'male1';
  }

  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string, _model?: string): Promise<void> {
    const { callSid, streamSid } = session;
    if (!text || !text.trim()) return;

    const selectedVoice = this.resolveVoice(voice || session.agent?.voice || undefined);

    logger.info('[TTS_START]', {
      callSid,
      streamSid,
      provider: 'local',
      text: text.substring(0, 50),
      textLength: text.length,
      voice: selectedVoice,
    });

    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    if (!this.processingQueues.has(callSid)) this.processingQueues.set(callSid, []);
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
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[LOCAL_TTS_QUEUE_EMPTY_READY_FOR_USER]', { callSid });
      return;
    }

    const item = queue.shift()!;

    try {
      await this.requestAndStream(callSid, item.text, item.streamSid, ws, session, item.voice);
    } catch (error: any) {
      if (error?.name === 'AbortError') logger.info('[TTS_ABORTED]', { callSid });
      else logger.error('Local TTS failed', { callSid, error });
    }

    if (queue.length > 0 && !session.ttsAbortController?.signal.aborted) {
      setImmediate(() => this.processQueue(callSid, ws, session));
    } else {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[LOCAL_TTS_COMPLETE_READY_FOR_USER]', { callSid });
    }
  }

  private async requestAndStream(
    callSid: string,
    text: string,
    streamSid: string,
    ws: WebSocket,
    session: CallSession,
    voice: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('/tts', this.config.baseUrl);
      const transport = url.protocol === 'https:' ? https : http;
      const body = JSON.stringify({ text, voice });

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      logger.debug('[LOCAL_TTS_REQUEST]', {
        callSid,
        baseUrl: this.config.baseUrl,
        voice,
        textLength: text.length,
      });

      const abortSignal = session.ttsAbortController?.signal;
      const abortHandler = () => {
        req.destroy();
        const err = new Error('TTS aborted');
        err.name = 'AbortError';
        reject(err);
      };
      abortSignal?.addEventListener('abort', abortHandler);

      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          abortSignal?.removeEventListener('abort', abortHandler);

          if (res.statusCode !== 200) {
            const errorBody = Buffer.concat(chunks).toString('utf8');
            logger.error('[LOCAL_TTS_ERROR]', {
              callSid,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              errorBody: errorBody.substring(0, 200),
              voice,
            });
            reject(new Error(`Local TTS API error: ${res.statusCode} ${res.statusMessage} ${errorBody}`));
            return;
          }

          try {
            const wav = Buffer.concat(chunks);
            const audio = wavToMulaw8k(wav); // μ-law 8 kHz mono

            const seconds = audio.length / 8000;
            session.ttsSeconds = (session.ttsSeconds || 0) + seconds;

            logger.info('[LOCAL_TTS_STREAMING]', {
              callSid,
              wavBytes: wav.length,
              audioBytes: audio.length,
              durationSeconds: seconds.toFixed(2),
            });

            // Stream to Twilio in 160-byte frames (20ms @ 8k μ-law).
            const CHUNK = 160;
            let chunksSent = 0;
            for (let off = 0; off < audio.length; off += CHUNK) {
              if (abortSignal?.aborted) break;
              const slice = audio.subarray(off, Math.min(off + CHUNK, audio.length));
              const mediaMessage = {
                event: 'media',
                streamSid,
                media: { payload: slice.toString('base64') },
              };
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(mediaMessage));
                chunksSent++;

                if (chunksSent === 1) {
                  logger.info('[LOCAL_TTS_FIRST_CHUNK]', { callSid });
                }
              } else {
                logger.warn('[LOCAL_TTS_WS_NOT_OPEN]', { callSid, readyState: ws.readyState });
              }
            }

            logger.info('[TTS_END]', {
              callSid,
              streamSid,
              provider: 'local',
              chunksSent,
              durationSeconds: seconds.toFixed(2),
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        });
        res.on('error', (error) => {
          abortSignal?.removeEventListener('abort', abortHandler);
          reject(error);
        });
      });

      this.activeRequests.set(callSid, req);

      req.on('error', (error: any) => {
        abortSignal?.removeEventListener('abort', abortHandler);
        if (error?.code !== 'ECONNRESET' && !abortSignal?.aborted) {
          logger.error('Local TTS request failed', { callSid, error });
          reject(error);
        } else {
          resolve();
        }
      });

      req.write(body);
      req.end();
    });
  }

  stopSpeaking(session: CallSession, ws: WebSocket): void {
    const { callSid, streamSid } = session;

    logger.info('[TTS_STOPPED]', { callSid, provider: 'local' });

    if (session.ttsAbortController) {
      session.ttsAbortController.abort();
    }

    this.abort(callSid);
    this.clearQueue(callSid);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'clear', streamSid }));
    }

    session.isSpeaking = false;
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
    logger.debug('TTS cleanup completed', { callSid });
  }
}
