import WebSocket from 'ws';
import * as https from 'https';
import { createLogger } from '../utils/logger';
import { CallSession } from '../voiceGateway/types';

const logger = createLogger('SarvamTTS');

export interface SarvamTTSConfig {
  apiKey: string;
  model?: 'bulbul:v3' | 'bulbul:v2';
}

interface TTSQueueItem {
  text: string;
  streamSid: string;
  voice: string; // Sarvam "speaker" (e.g. shubh)
  model?: 'bulbul:v3' | 'bulbul:v2';
  languageCode?: string; // BCP-47, e.g. en-IN
}

export class SarvamTTS {
  private config: SarvamTTSConfig;
  private processingQueues: Map<string, TTSQueueItem[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private activeRequests: Map<string, any> = new Map();

  constructor(config: SarvamTTSConfig) {
    this.config = {
      model: 'bulbul:v3',
      ...config,
    };
    logger.info('SarvamTTS initialized', { model: this.config.model });
  }

  startStream(session: CallSession): void {
    const { callSid } = session;
    logger.info('[TTS_STREAM_START]', { callSid, provider: 'sarvam' });
    this.clearQueue(callSid);
    this.abort(callSid);
  }

  async sendChunk(
    session: CallSession,
    text: string,
    ws: WebSocket,
    voice?: string,
    model?: 'bulbul:v3' | 'bulbul:v2',
  ): Promise<void> {
    await this.speak(session, text, ws, voice, model);
  }

  endStream(session: CallSession): void {
    logger.info('[TTS_STREAM_END]', { callSid: session.callSid, provider: 'sarvam' });
  }

  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: 'bulbul:v3' | 'bulbul:v2'): Promise<void> {
    const { callSid, streamSid } = session;
    if (!text || !text.trim()) return;

    const speaker = voice || session.agent?.voice || 'shubh';
    const targetLanguage = this.toSarvamLanguage(session.agent?.language) || 'en-IN';

    logger.info('[SARVAM_TTS_SPEAK]', {
      callSid,
      text: text.substring(0, 50),
      speaker,
      model: model || this.config.model,
      language: targetLanguage,
    });

    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    if (!this.processingQueues.has(callSid)) this.processingQueues.set(callSid, []);
    this.processingQueues.get(callSid)!.push({
      text,
      streamSid,
      voice: speaker,
      model: model || this.config.model,
      languageCode: targetLanguage,
    });

    if (!this.isProcessing.get(callSid)) this.processQueue(callSid, ws, session);
  }

  private toSarvamLanguage(lang?: string | null): string | null {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l === 'en' || l.startsWith('en')) return 'en-IN';
    if (l === 'hi' || l.startsWith('hi')) return 'hi-IN';
    if (l === 'ta' || l.startsWith('ta')) return 'ta-IN';
    if (l === 'te' || l.startsWith('te')) return 'te-IN';
    if (l === 'bn' || l.startsWith('bn')) return 'bn-IN';
    if (l === 'mr' || l.startsWith('mr')) return 'mr-IN';
    if (l === 'gu' || l.startsWith('gu')) return 'gu-IN';
    if (l === 'kn' || l.startsWith('kn')) return 'kn-IN';
    if (l === 'ml' || l.startsWith('ml')) return 'ml-IN';
    if (l === 'pa' || l.startsWith('pa')) return 'pa-IN';
    if (l === 'or' || l.startsWith('od')) return 'od-IN';
    return 'en-IN';
  }

  private async processQueue(callSid: string, ws: WebSocket, session: CallSession): Promise<void> {
    this.isProcessing.set(callSid, true);
    const queue = this.processingQueues.get(callSid);
    if (!queue || queue.length === 0) {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[SARVAM_TTS_QUEUE_EMPTY_READY_FOR_USER]', { callSid });
      return;
    }

    const item = queue.shift()!;
    try {
      await this.requestAndStream(callSid, item.text, item.streamSid, ws, session, item.voice, item.model, item.languageCode);
    } catch (error: any) {
      if (error?.name === 'AbortError') logger.info('[TTS_ABORTED]', { callSid });
      else logger.error('Sarvam TTS failed', { callSid, error });
    }

    if (queue.length > 0 && !session.ttsAbortController?.signal.aborted) {
      setImmediate(() => this.processQueue(callSid, ws, session));
    } else {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[SARVAM_TTS_COMPLETE_READY_FOR_USER]', { callSid });
    }
  }

  private async requestAndStream(
    callSid: string,
    text: string,
    streamSid: string,
    ws: WebSocket,
    session: CallSession,
    speaker: string,
    model?: 'bulbul:v3' | 'bulbul:v2',
    targetLanguageCode?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('https://api.sarvam.ai/text-to-speech');
      const body = JSON.stringify({
        text,
        target_language_code: targetLanguageCode || 'en-IN',
        model: model || this.config.model || 'bulbul:v3',
        speaker,
        pace: session.agent?.speechRate ?? 1,
        speech_sample_rate: '8000',
        output_audio_codec: 'mulaw',
      });

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'api-subscription-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      logger.debug('[SARVAM_TTS_REQUEST]', {
        callSid,
        speaker,
        model: model || this.config.model,
        targetLanguageCode: targetLanguageCode || 'en-IN',
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

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          abortSignal?.removeEventListener('abort', abortHandler);

          if (res.statusCode !== 200) {
            const errorBody = Buffer.concat(chunks).toString('utf8');
            logger.error('[SARVAM_TTS_ERROR]', {
              callSid,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              errorBody,
              speaker,
            });
            reject(new Error(`Sarvam TTS API error: ${res.statusCode} ${res.statusMessage} ${errorBody}`));
            return;
          }
          
          logger.info('[SARVAM_TTS_RESPONSE_RECEIVED]', { callSid, speaker });

          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const audioB64: string | undefined = Array.isArray(json?.audios) ? json.audios[0] : undefined;
            if (!audioB64) throw new Error('Sarvam TTS: missing audios[0]');
            const audio = Buffer.from(audioB64, 'base64'); // expected μ-law bytes at 8k (output_audio_codec=mulaw)

            const seconds = audio.length / 8000;
            session.ttsSeconds = (session.ttsSeconds || 0) + seconds;

            logger.info('[SARVAM_TTS_STREAMING]', { 
              callSid, 
              audioBytes: audio.length,
              durationSeconds: seconds.toFixed(2),
            });

            // Stream to Twilio in chunks to avoid huge single frames.
            const CHUNK = 160; // 20ms @ 8k ulaw
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
                  logger.info('[SARVAM_TTS_FIRST_CHUNK]', { callSid });
                }
              } else {
                logger.warn('[SARVAM_TTS_WS_NOT_OPEN]', { callSid, readyState: ws.readyState });
              }
            }

            logger.info('[SARVAM_TTS_COMPLETE]', { 
              callSid, 
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

