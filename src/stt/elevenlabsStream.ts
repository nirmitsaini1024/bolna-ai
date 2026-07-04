import WebSocket from 'ws';
import { createLogger } from '../utils/logger';
import type { TranscriptResult } from './deepgramStream';

const logger = createLogger('ElevenLabsStream');

export interface ElevenLabsSttConfig {
  apiKey: string;
  model?: string; // e.g. scribe_v2_realtime
  languageCode?: string; // ISO 639-1
  audioFormat?: 'ulaw_8000' | 'pcm_8000' | 'pcm_16000';
  commitStrategy?: 'manual' | 'vad';
}

export class ElevenLabsStream {
  private ws: WebSocket | null = null;
  private callSid: string;
  private config: ElevenLabsSttConfig;
  private isConnected = false;
  private onTranscriptCallback?: (result: TranscriptResult) => void;
  private sentFirstChunk = false;

  constructor(callSid: string, config: ElevenLabsSttConfig) {
    this.callSid = callSid;
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildWsUrl();

      logger.info('Connecting to ElevenLabs STT', {
        callSid: this.callSid,
        model: this.config.model,
        audioFormat: this.config.audioFormat,
      });

      this.ws = new WebSocket(url, {
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        logger.info('ElevenLabs STT connection established', { callSid: this.callSid });
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error('ElevenLabs STT WebSocket error', {
          callSid: this.callSid,
          error: (error as Error).message,
        });
        this.isConnected = false;
      });

      this.ws.on('close', (code, reason) => {
        logger.info('ElevenLabs STT connection closed', {
          callSid: this.callSid,
          code,
          reason: reason.toString(),
        });
        this.isConnected = false;
      });

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('ElevenLabs STT connection timeout'));
        }
      }, 10000);

      this.ws.once('open', () => clearTimeout(timeout));
    });
  }

  private buildWsUrl(): string {
    const params = new URLSearchParams();
    params.set('model_id', this.config.model || 'scribe_v2_realtime');
    params.set('audio_format', this.config.audioFormat || 'ulaw_8000');
    params.set('commit_strategy', this.config.commitStrategy || 'vad');
    params.set('include_timestamps', 'false');
    params.set('enable_logging', 'true');
    if (this.config.languageCode) {
      params.set('language_code', this.config.languageCode);
    }
    return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const msg = JSON.parse(data.toString());

      if (msg?.message_type === 'partial_transcript') {
        // ignore partials for now
        return;
      }

      if (msg?.message_type === 'committed_transcript' || msg?.message_type === 'committed_transcript_with_timestamps') {
        const text: string | undefined = msg.text;
        if (text && text.trim()) {
          const result: TranscriptResult = {
            text,
            isFinal: true,
            confidence: undefined,
          };
          this.onTranscriptCallback?.(result);
        }
        return;
      }

      if (msg?.message_type === 'error' || msg?.message_type === 'auth_error') {
        logger.error('ElevenLabs STT error', { callSid: this.callSid, msg });
        return;
      }
    } catch (error) {
      logger.error('Failed to parse ElevenLabs STT message', {
        callSid: this.callSid,
        error,
      });
    }
  }

  sendAudio(audioBuffer: Buffer): boolean {
    if (!this.ws || !this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const payload: any = {
        message_type: 'input_audio_chunk',
        audio_base_64: audioBuffer.toString('base64'),
        commit: false,
        sample_rate: 8000,
      };

      if (!this.sentFirstChunk) {
        this.sentFirstChunk = true;
        // Optional: send a small context if needed later via previous_text.
      }

      this.ws.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      logger.error('Failed to send audio to ElevenLabs STT', {
        callSid: this.callSid,
        error,
      });
      return false;
    }
  }

  onTranscript(callback: (result: TranscriptResult) => void): void {
    this.onTranscriptCallback = callback;
  }

  async close(): Promise<void> {
    if (!this.ws) return;

    const ws = this.ws;
    this.ws = null;
    this.isConnected = false;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          ws.terminate();
        } catch {}
        resolve();
      }, 2000);

      ws.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });

      try {
        ws.close();
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}

