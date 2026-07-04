import * as http from 'http';
import * as https from 'https';
import { createLogger } from '../utils/logger';
import { TranscriptResult } from './deepgramStream';
import { mulawBufferToWav, mulawChunkEnergy } from '../utils/audioConvert';

const logger = createLogger('LocalStream');

export interface LocalSttConfig {
  baseUrl: string; // e.g. http://DROPLET_IP:8000
  silenceThresholdMs?: number; // silence gap that ends an utterance (default 1000)
  minSpeechMs?: number; // minimum speech before we transcribe (default 600)
}

/**
 * LocalStream adapts the batch-only in-house faster-whisper endpoint
 * (POST /stt, multipart WAV upload) to Bolna's streaming STT interface.
 *
 * Unlike DeepgramStream there is no server-side VAD, so this class buffers
 * μ-law chunks from Twilio (~50/sec via sendAudio) and does silence-based
 * endpointing locally:
 *
 * 1. Each incoming chunk's energy is measured (cheap μ-law decode + avg |amplitude|)
 * 2. Once speech is detected and then goes silent for silenceThresholdMs,
 *    the buffered utterance is wrapped into a WAV and POSTed to /stt
 * 3. The transcription is emitted as a FINAL transcript (no partials — the
 *    batch endpoint can't produce them incrementally)
 *
 * Transcription runs async off a monitor timer so sendAudio never blocks,
 * and an in-flight lock prevents overlapping /stt calls per callSid.
 * Expect ~1-3s latency on CPU — slower than Deepgram streaming, acceptable for v1.
 */
export class LocalStream {
  private callSid: string;
  private config: Required<LocalSttConfig>;
  private isConnected: boolean = false;
  private onTranscriptCallback?: (result: TranscriptResult) => void;

  private chunks: Buffer[] = [];
  private bufferedBytes: number = 0;
  private firstSpeechChunkIndex: number = -1;
  private speechStartTime: number = 0;
  private lastSpeechTime: number = 0;
  private isTranscribing: boolean = false;
  private monitorTimer: NodeJS.Timeout | null = null;

  // Avg |PCM16 amplitude| above which a 20ms chunk counts as speech.
  private static readonly ENERGY_THRESHOLD = 300;
  // Keep ~200ms of audio before the first speech chunk so onsets aren't clipped.
  private static readonly PRE_ROLL_CHUNKS = 10;
  // Safety valve: force a flush if an utterance exceeds 60s (480000 bytes @ 8k μ-law).
  private static readonly MAX_UTTERANCE_BYTES = 60 * 8000;
  private static readonly MONITOR_INTERVAL_MS = 100;

  constructor(callSid: string, config: LocalSttConfig) {
    this.callSid = callSid;
    this.config = {
      baseUrl: config.baseUrl,
      silenceThresholdMs: config.silenceThresholdMs ?? 1000,
      minSpeechMs: config.minSpeechMs ?? 600,
    };
  }

  /**
   * "Connecting" for a batch endpoint means verifying the server is up.
   * Throws if /health is unreachable so the caller can fall back to Deepgram.
   */
  async connect(): Promise<void> {
    logger.info('Connecting to local voice server', {
      callSid: this.callSid,
      baseUrl: this.config.baseUrl,
      silenceThresholdMs: this.config.silenceThresholdMs,
    });

    await this.healthCheck();

    this.isConnected = true;
    this.monitorTimer = setInterval(() => this.checkEndpointing(), LocalStream.MONITOR_INTERVAL_MS);

    logger.info('Local voice server ready', { callSid: this.callSid });
  }

  private healthCheck(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('/health', this.config.baseUrl);
      const transport = url.protocol === 'https:' ? https : http;

      const req = transport.get(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          timeout: 5000,
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

  sendAudio(audioBuffer: Buffer): boolean {
    if (!this.isConnected) {
      logger.warn('Cannot send audio: not connected', { callSid: this.callSid });
      return false;
    }

    if (!audioBuffer || audioBuffer.length === 0) return true;

    this.chunks.push(audioBuffer);
    this.bufferedBytes += audioBuffer.length;

    const energy = mulawChunkEnergy(audioBuffer);
    if (energy >= LocalStream.ENERGY_THRESHOLD) {
      const now = Date.now();
      if (this.firstSpeechChunkIndex < 0) {
        this.firstSpeechChunkIndex = this.chunks.length - 1;
        this.speechStartTime = now;
        logger.debug('[LOCAL_STT_SPEECH_START]', { callSid: this.callSid, energy: Math.round(energy) });
      }
      this.lastSpeechTime = now;
    }

    // Without speech, cap the rolling silence buffer so memory stays bounded.
    if (this.firstSpeechChunkIndex < 0 && this.chunks.length > LocalStream.PRE_ROLL_CHUNKS) {
      const dropped = this.chunks.splice(0, this.chunks.length - LocalStream.PRE_ROLL_CHUNKS);
      for (const c of dropped) this.bufferedBytes -= c.length;
    }

    return true;
  }

  /**
   * Runs on a timer: ends the utterance once speech has been followed by
   * silenceThresholdMs of quiet (or the utterance hits the max length).
   */
  private checkEndpointing(): void {
    if (this.firstSpeechChunkIndex < 0 || this.isTranscribing) return;

    const now = Date.now();
    const speechDuration = this.lastSpeechTime - this.speechStartTime;
    const silenceDuration = now - this.lastSpeechTime;
    const tooLong = this.bufferedBytes >= LocalStream.MAX_UTTERANCE_BYTES;

    if (!tooLong && silenceDuration < this.config.silenceThresholdMs) return;

    if (speechDuration < this.config.minSpeechMs && !tooLong) {
      // Too short to be real speech (noise blip) — discard and rearm.
      logger.debug('[LOCAL_STT_UTTERANCE_TOO_SHORT_DISCARDED]', {
        callSid: this.callSid,
        speechDuration,
      });
      this.resetBuffer();
      return;
    }

    const utterance = this.takeUtterance();
    if (utterance.length === 0) return;

    void this.transcribe(utterance);
  }

  /** Slice out the current utterance (with pre-roll) and reset the buffer. */
  private takeUtterance(): Buffer {
    const startIdx = Math.max(0, this.firstSpeechChunkIndex - LocalStream.PRE_ROLL_CHUNKS);
    const utterance = Buffer.concat(this.chunks.slice(startIdx));
    this.resetBuffer();
    return utterance;
  }

  private resetBuffer(): void {
    this.chunks = [];
    this.bufferedBytes = 0;
    this.firstSpeechChunkIndex = -1;
    this.speechStartTime = 0;
    this.lastSpeechTime = 0;
  }

  private async transcribe(mulawUtterance: Buffer): Promise<void> {
    this.isTranscribing = true;
    const startedAt = Date.now();

    try {
      const wav = mulawBufferToWav(mulawUtterance, 8000);

      logger.info('[LOCAL_STT_TRANSCRIBING]', {
        callSid: this.callSid,
        audioBytes: mulawUtterance.length,
        durationSeconds: (mulawUtterance.length / 8000).toFixed(2),
      });

      const response = await this.postStt(wav);
      const text = (response?.text || '').trim();
      const latencyMs = Date.now() - startedAt;

      if (text.length > 0) {
        const result: TranscriptResult = {
          text,
          isFinal: true,
          confidence: 1.0,
        };

        logger.info('Transcript received', {
          callSid: this.callSid,
          text: result.text,
          isFinal: result.isFinal,
          language: response?.language,
          latencyMs,
        });

        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(result);
        }
      } else {
        logger.debug('[LOCAL_STT_EMPTY_TRANSCRIPT]', { callSid: this.callSid, latencyMs });
      }
    } catch (error) {
      logger.error('Local STT transcription failed', { callSid: this.callSid, error });
    } finally {
      this.isTranscribing = false;
    }
  }

  /** Multipart-upload the WAV to POST /stt and parse the JSON response. */
  private postStt(wav: Buffer): Promise<{ text?: string; language?: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL('/stt', this.config.baseUrl);
      const transport = url.protocol === 'https:' ? https : http;

      const boundary = `----BolnaLocalStt${this.callSid.replace(/\W/g, '')}${Date.now()}`;
      const head = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="utterance.wav"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`,
      );
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([head, wav, tail]);

      const req = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
          timeout: 30000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode !== 200) {
              reject(new Error(`Local STT API error: ${res.statusCode} ${res.statusMessage} ${raw.substring(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(raw));
            } catch (error) {
              reject(new Error(`Local STT: invalid JSON response: ${raw.substring(0, 200)}`));
            }
          });
          res.on('error', reject);
        },
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Local STT request timeout'));
      });
      req.on('error', reject);

      req.write(body);
      req.end();
    });
  }

  onTranscript(callback: (result: TranscriptResult) => void): void {
    this.onTranscriptCallback = callback;
  }

  async close(): Promise<void> {
    logger.info('Closing local STT stream', { callSid: this.callSid });

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    // Flush any utterance still in the buffer (e.g. caller hung up mid-sentence).
    if (this.isConnected && this.firstSpeechChunkIndex >= 0 && !this.isTranscribing) {
      const speechDuration = this.lastSpeechTime - this.speechStartTime;
      if (speechDuration >= this.config.minSpeechMs) {
        const utterance = this.takeUtterance();
        if (utterance.length > 0) {
          await this.transcribe(utterance);
        }
      }
    }

    this.resetBuffer();
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
