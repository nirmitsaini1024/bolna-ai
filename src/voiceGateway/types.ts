/**
 * Type definitions for Twilio Media Streams
 * 
 * Twilio Media Streams Documentation:
 * https://www.twilio.com/docs/voice/media-streams
 * 
 * Event Flow:
 * 1. START: Contains call metadata and audio configuration
 * 2. MEDIA: Streams continuously at ~50 events/second (20ms chunks)
 * 3. STOP: Signals call termination
 * 4. MARK: Optional marker for synchronization (not used in Phase 1)
 * 
 * Audio Format:
 * - Encoding: μ-law (G.711), 8-bit samples
 * - Sample Rate: 8000 Hz (narrowband telephony)
 * - Channels: 1 (mono)
 * - Chunk Duration: ~20ms per payload
 * - Tracks: 'inbound' (caller audio) and 'outbound' (to caller)
 */

export interface TwilioMediaStreamEvent {
  event: 'start' | 'media' | 'stop' | 'mark' | 'connected' | 'dtmf';
  sequenceNumber?: string;
  streamSid?: string;
}

export interface TwilioStartEvent extends TwilioMediaStreamEvent {
  event: 'start';
  streamSid: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: ('inbound' | 'outbound')[];
    mediaFormat: {
      encoding: 'audio/x-mulaw';
      sampleRate: 8000;
      channels: 1;
    };
    customParameters?: Record<string, string>;
  };
}

export interface TwilioMediaEvent extends TwilioMediaStreamEvent {
  event: 'media';
  sequenceNumber: string;
  media: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string;
  };
}

export interface TwilioStopEvent extends TwilioMediaStreamEvent {
  event: 'stop';
  streamSid: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
}

export interface TwilioMarkEvent extends TwilioMediaStreamEvent {
  event: 'mark';
  streamSid: string;
  mark: {
    name: string;
  };
}

export interface TwilioConnectedEvent extends TwilioMediaStreamEvent {
  event: 'connected';
  streamSid: string;
  protocol: string;
  version: string;
}

export interface TwilioDtmfEvent extends TwilioMediaStreamEvent {
  event: 'dtmf';
  streamSid: string;
  sequenceNumber: string;
  dtmf: {
    digit: string;
    track: 'inbound' | 'outbound';
  };
}

export type TwilioEvent = TwilioStartEvent | TwilioMediaEvent | TwilioStopEvent | TwilioMarkEvent | TwilioConnectedEvent | TwilioDtmfEvent;

import { Agent } from '@prisma/client';

/**
 * Message in conversation history
 * Phase 3: Used for LLM context
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/**
 * CallSession represents the state of an active call stream.
 * 
 * Each WebSocket connection corresponds to one call session.
 * This data structure is maintained for the duration of the call.
 * 
 * Phase 1.5+: Includes audio queue and STT stream management.
 * Phase 3: Includes conversation history for LLM reasoning.
 * Phase 5: Includes barge-in support with TTS interruption.
 * Phase 6: Includes agent configuration loaded from database.
 */
export interface CallSession {
  streamSid: string;
  callSid: string;
  accountSid: string;
  startedAt: Date;
  callId?: string;
  customerId?: string;
  tracks: ('inbound' | 'outbound')[];
  mediaFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  audioQueue: any;
  sttStream?: any;
  conversationHistory: ConversationMessage[];
  ws?: any;
  isSpeaking: boolean;
  ttsAbortController?: AbortController;
  agent?: Agent;
  agentConfig?: Agent;
  toPhoneNumber?: string;
  fromPhoneNumber?: string;
  customerHistorySummary?: string;
  sttSeconds?: number;
  ttsSeconds?: number;
  llmTokens?: number;

  interruptWords?: number;
  silenceTimeout?: number;
  maxCallDuration?: number;
  responseLatency?: number;
  endpointingMs?: number;
  finalCallMessage?: string;
}

/**
 * AudioChunk represents a decoded audio segment.
 * 
 * The payload is a Buffer containing raw audio data.
 * In Phase 1, we decode but don't process it yet.
 * In Phase 2, this will be sent to STT services.
 */
export interface AudioChunk {
  track: 'inbound' | 'outbound';
  timestamp: string;
  payload: Buffer;
  sequenceNumber: string;
}
