import WebSocket from 'ws';
import { createLogger } from '../utils/logger';

const logger = createLogger('DeepgramStream');

export interface DeepgramConfig {
  apiKey: string;
  encoding: 'mulaw' | 'linear16';
  sampleRate: number;
  channels: number;
}

export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

/**
 * DeepgramStream manages a WebSocket connection to Deepgram's streaming STT API.
 * 
 * Architecture:
 * - One stream per call session
 * - Bidirectional WebSocket: sends audio, receives transcripts
 * - Non-blocking audio transmission
 * 
 * Deepgram Streaming Protocol:
 * 1. Connect to WSS endpoint with config params
 * 2. Send audio chunks as binary frames
 * 3. Receive JSON transcript messages
 * 4. Send empty buffer or close to finalize
 * 
 * Important:
 * - Audio must be sent in real-time or faster
 * - Connection timeout is 12 seconds of silence
 * - Keep connection alive by sending audio regularly
 */
export class DeepgramStream {
  private ws: WebSocket | null = null;
  private callSid: string;
  private config: DeepgramConfig;
  private isConnected: boolean = false;
  private onTranscriptCallback?: (result: TranscriptResult) => void;

  constructor(callSid: string, config: DeepgramConfig) {
    this.callSid = callSid;
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildStreamUrl();
      
      logger.info('Connecting to Deepgram', { 
        callSid: this.callSid,
        encoding: this.config.encoding,
        sampleRate: this.config.sampleRate,
      });

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Token ${this.config.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        logger.info('Deepgram connection established', { callSid: this.callSid });
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error('Deepgram WebSocket error', { 
          callSid: this.callSid, 
          error: error.message 
        });
        this.isConnected = false;
      });

      this.ws.on('close', (code, reason) => {
        logger.info('Deepgram connection closed', { 
          callSid: this.callSid,
          code,
          reason: reason.toString(),
        });
        this.isConnected = false;
      });

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Deepgram connection timeout'));
        }
      }, 10000);

      this.ws.once('open', () => clearTimeout(timeout));
    });
  }

  private buildStreamUrl(): string {
    const params = new URLSearchParams({
      encoding: this.config.encoding,
      sample_rate: this.config.sampleRate.toString(),
      channels: this.config.channels.toString(),
      model: 'nova-2',
      interim_results: 'true',
      punctuate: 'true',
      utterance_end_ms: '1000',
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'Results') {
        const channel = message.channel;
        
        if (channel && channel.alternatives && channel.alternatives.length > 0) {
          const alternative = channel.alternatives[0];
          const transcript = alternative.transcript;

          if (transcript && transcript.trim().length > 0) {
            const result: TranscriptResult = {
              text: transcript,
              isFinal: message.is_final || false,
              confidence: alternative.confidence,
            };

            logger.info('Transcript received', {
              callSid: this.callSid,
              text: result.text,
              isFinal: result.isFinal,
              confidence: result.confidence,
            });

            if (this.onTranscriptCallback) {
              this.onTranscriptCallback(result);
            }
          }
        }
      } else if (message.type === 'Metadata') {
        logger.debug('Deepgram metadata', { 
          callSid: this.callSid,
          requestId: message.request_id,
        });
      } else if (message.type === 'UtteranceEnd') {
        logger.debug('Utterance end detected', { callSid: this.callSid });
      }
    } catch (error) {
      logger.error('Failed to parse Deepgram message', { 
        callSid: this.callSid, 
        error 
      });
    }
  }

  sendAudio(audioBuffer: Buffer): boolean {
    if (!this.ws || !this.isConnected) {
      logger.warn('Cannot send audio: not connected', { callSid: this.callSid });
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send audio: WebSocket not open', { 
        callSid: this.callSid,
        readyState: this.ws.readyState,
      });
      return false;
    }

    try {
      this.ws.send(audioBuffer);
      return true;
    } catch (error) {
      logger.error('Failed to send audio to Deepgram', { 
        callSid: this.callSid, 
        error 
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

    logger.info('Closing Deepgram stream', { callSid: this.callSid });

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
