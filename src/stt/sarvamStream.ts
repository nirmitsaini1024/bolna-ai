import WebSocket from 'ws';
import { createLogger } from '../utils/logger';
import type { TranscriptResult } from './deepgramStream';

const logger = createLogger('SarvamStream');

export interface SarvamConfig {
  apiKey: string;
  encoding: 'mulaw' | 'linear16';
  sampleRate: number;
  channels: number;
}

/**
 * SarvamStream is implemented to mirror DeepgramStream's public interface
 * so StreamHandler can treat STT providers uniformly.
 *
 * This implementation assumes Sarvam provides a WebSocket streaming API
 * with JSON transcript messages. Adjust the URL, headers and message
 * parsing to match your actual Sarvam account/docs.
 */
export class SarvamStream {
  private ws: WebSocket | null = null;
  private callSid: string;
  private config: SarvamConfig;
  private isConnected = false;
  private onTranscriptCallback?: (result: TranscriptResult) => void;

  constructor(callSid: string, config: SarvamConfig) {
    this.callSid = callSid;
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildStreamUrl();

      logger.info('Connecting to Sarvam', {
        callSid: this.callSid,
        encoding: this.config.encoding,
        sampleRate: this.config.sampleRate,
      });

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        logger.info('Sarvam connection established', { callSid: this.callSid });
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error('Sarvam WebSocket error', {
          callSid: this.callSid,
          error: (error as Error).message,
        });
        this.isConnected = false;
      });

      this.ws.on('close', (code, reason) => {
        logger.info('Sarvam connection closed', {
          callSid: this.callSid,
          code,
          reason: reason.toString(),
        });
        this.isConnected = false;
      });

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Sarvam connection timeout'));
        }
      }, 10000);

      this.ws.once('open', () => clearTimeout(timeout));
    });
  }

  // TODO: replace with the real Sarvam streaming endpoint + query params
  private buildStreamUrl(): string {
    const params = new URLSearchParams({
      encoding: this.config.encoding,
      sample_rate: this.config.sampleRate.toString(),
      channels: this.config.channels.toString(),
    });

    return `wss://api.sarvam.ai/v1/listen?${params.toString()}`;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Adjust these fields to Sarvam's actual response schema
      if (message.type === 'results' || message.type === 'result') {
        const transcript: string | undefined = message.text ?? message.transcript;
        const isFinal: boolean = Boolean(message.is_final ?? message.final);
        const confidence: number | undefined = message.confidence;

        if (transcript && transcript.trim().length > 0) {
          const result: TranscriptResult = {
            text: transcript,
            isFinal,
            confidence,
          };

          logger.info('Sarvam transcript received', {
            callSid: this.callSid,
            text: result.text,
            isFinal: result.isFinal,
            confidence: result.confidence,
          });

          if (this.onTranscriptCallback) {
            this.onTranscriptCallback(result);
          }
        }
      } else {
        logger.debug('Sarvam message', {
          callSid: this.callSid,
          message,
        });
      }
    } catch (error) {
      logger.error('Failed to parse Sarvam message', {
        callSid: this.callSid,
        error,
      });
    }
  }

  sendAudio(audioBuffer: Buffer): boolean {
    if (!this.ws || !this.isConnected) {
      logger.warn('Cannot send audio: Sarvam not connected', { callSid: this.callSid });
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send audio: Sarvam WebSocket not open', {
        callSid: this.callSid,
        readyState: this.ws.readyState,
      });
      return false;
    }

    try {
      this.ws.send(audioBuffer);
      return true;
    } catch (error) {
      logger.error('Failed to send audio to Sarvam', {
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
    if (!this.ws) {
      return;
    }

    logger.info('Closing Sarvam stream', { callSid: this.callSid });

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(Buffer.alloc(0));

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.terminate();
          }
          resolve();
        }, 2000);

        this.ws?.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws?.close();
      });
    } else {
      this.ws.terminate();
    }

    this.ws = null;
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

