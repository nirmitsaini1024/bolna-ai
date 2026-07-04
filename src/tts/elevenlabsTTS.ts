import WebSocket from 'ws';
import * as https from 'https';
import { createLogger } from '../utils/logger';
import { CallSession } from '../voiceGateway/types';

const logger = createLogger('ElevenLabsTTS');

export interface ElevenLabsTTSConfig {
  apiKey: string;
  model?: string; // e.g. eleven_flash_v2_5
  outputFormat?: 'ulaw_8000' | 'pcm_8000' | 'mp3_22050_32';
}

interface TTSQueueItem {
  text: string;
  streamSid: string;
  voice: string;
  model?: string;
}

export class ElevenLabsTTS {
  private config: ElevenLabsTTSConfig;
  private processingQueues: Map<string, TTSQueueItem[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private activeRequests: Map<string, any> = new Map();

  constructor(config: ElevenLabsTTSConfig) {
    this.config = {
      model: 'eleven_flash_v2_5',
      outputFormat: 'ulaw_8000',
      ...config,
    };
    logger.info('ElevenLabsTTS initialized', {
      model: this.config.model,
      outputFormat: this.config.outputFormat,
    });
  }

  startStream(session: CallSession): void {
    const { callSid } = session;
    logger.info('[TTS_STREAM_START]', { callSid, provider: 'elevenlabs' });
    this.clearQueue(callSid);
    this.abort(callSid);
  }

  async sendChunk(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: string): Promise<void> {
    await this.speak(session, text, ws, voice, model);
  }

  endStream(session: CallSession): void {
    logger.info('[TTS_STREAM_END]', { callSid: session.callSid, provider: 'elevenlabs' });
  }

  async speak(session: CallSession, text: string, ws: WebSocket, voice?: string, model?: string): Promise<void> {
    const { callSid, streamSid } = session;

    if (!text || !text.trim()) return;

    const selectedVoice = voice || session.agent?.voice || 'JBFqnCBsd6RMkjVDRZzb'; // Default: George (conversational)
    
    logger.info('[ELEVENLABS_TTS_SPEAK]', {
      callSid,
      text: text.substring(0, 50),
      voiceId: selectedVoice,
      model: model || this.config.model,
    });

    session.isSpeaking = true;
    session.ttsAbortController = new AbortController();

    if (!this.processingQueues.has(callSid)) this.processingQueues.set(callSid, []);
    this.processingQueues.get(callSid)!.push({
      text,
      streamSid,
      voice: selectedVoice,
      model: model || this.config.model,
    });

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
      logger.debug('[ELEVENLABS_TTS_QUEUE_EMPTY_READY_FOR_USER]', { callSid });
      return;
    }

    const item = queue.shift()!;
    try {
      await this.streamTextToSpeech(callSid, item.text, item.streamSid, ws, session, item.voice, item.model);
    } catch (error: any) {
      if (error?.name === 'AbortError') logger.info('[TTS_ABORTED]', { callSid });
      else logger.error('ElevenLabs TTS streaming failed', { callSid, error });
    }

    if (queue.length > 0 && !session.ttsAbortController?.signal.aborted) {
      setImmediate(() => this.processQueue(callSid, ws, session));
    } else {
      this.isProcessing.set(callSid, false);
      session.isSpeaking = false;
      session.hasRespondedToCurrentUtterance = false;
      logger.debug('[ELEVENLABS_TTS_COMPLETE_READY_FOR_USER]', { callSid });
    }
  }

  private async streamTextToSpeech(
    callSid: string,
    text: string,
    streamSid: string,
    ws: WebSocket,
    session: CallSession,
    voiceId: string,
    modelId?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const outputFormat = this.config.outputFormat || 'ulaw_8000';
      const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=2`);

      const body = JSON.stringify({
        text,
        model_id: modelId || this.config.model || 'eleven_flash_v2_5',
        voice_settings: {
          stability: session.agent?.stability ?? undefined,
          similarity_boost: session.agent?.similarityBoost ?? undefined,
          style: session.agent?.styleExaggeration ?? undefined,
          speed: session.agent?.speechRate ?? undefined,
        },
      });

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
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

      logger.debug('[ELEVENLABS_TTS_REQUEST]', {
        callSid,
        voiceId,
        modelId: modelId || this.config.model,
        textLength: text.length,
        url: url.toString(),
      });

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          abortSignal?.removeEventListener('abort', abortHandler);
          
          let errorBody = '';
          res.on('data', (chunk) => { errorBody += chunk.toString(); });
          res.on('end', () => {
            logger.error('[ELEVENLABS_TTS_ERROR]', {
              callSid,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              errorBody,
              voiceId,
            });
          });
          
          reject(new Error(`ElevenLabs TTS API error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        
        logger.info('[ELEVENLABS_TTS_STREAMING]', { callSid, voiceId });

        let chunkCount = 0;
        let totalBytes = 0;
        
        res.on('data', (chunk: Buffer) => {
          if (abortSignal?.aborted) {
            res.destroy();
            return;
          }
          if (!chunk || chunk.length === 0) return;

          chunkCount++;
          totalBytes += chunk.length;

          // output_format=ulaw_8000 yields μ-law 8kHz bytes suitable for Twilio.
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
            
            if (chunkCount === 1) {
              logger.info('[ELEVENLABS_TTS_FIRST_CHUNK]', { callSid, chunkSize: chunk.length });
            }
          } else {
            logger.warn('[ELEVENLABS_TTS_WS_NOT_OPEN]', { callSid, readyState: ws.readyState });
          }
        });

        res.on('end', () => {
          abortSignal?.removeEventListener('abort', abortHandler);
          logger.info('[ELEVENLABS_TTS_COMPLETE]', { 
            callSid, 
            chunkCount, 
            totalBytes,
            durationSeconds: (totalBytes / 8000).toFixed(2),
          });
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

