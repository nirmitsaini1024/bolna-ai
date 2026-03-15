import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import {
  TwilioEvent,
  TwilioStartEvent,
  TwilioMediaEvent,
  TwilioStopEvent,
  TwilioConnectedEvent,
  TwilioDtmfEvent,
  CallSession,
  AudioChunk,
  ConversationMessage,
} from './types';
import { AudioQueue } from './audioQueue';
import { DeepgramStream, TranscriptResult } from '../stt/deepgramStream';
import { OpenRouterClient, Message } from '../llm/openrouterClient';
import { DeepgramTTS } from '../tts/deepgramTTS';
import { AgentService } from '../agents/agentService';

const logger = createLogger('StreamHandler');

const DEBUG_AUDIO = process.env.DEBUG_AUDIO === 'true';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEBUG_AUDIO_DIR = 'debug_audio';

if (DEBUG_AUDIO) {
  if (!fs.existsSync(DEBUG_AUDIO_DIR)) {
    fs.mkdirSync(DEBUG_AUDIO_DIR, { recursive: true });
    logger.info('Created debug audio directory', { dir: DEBUG_AUDIO_DIR });
  }
}

/**
 * StreamHandler processes Twilio Media Stream events for individual WebSocket connections.
 * 
 * Twilio Media Streams provide real-time bidirectional audio access during phone calls.
 * The stream consists of event types:
 * 
 * 1. CONNECTED: Initial connection acknowledgment
 * 2. START: Contains call metadata and audio format info
 * 3. MEDIA: Streams continuously (~50 times/second), contains 20ms audio chunks (base64 encoded μ-law)
 * 4. DTMF: Digit pressed by caller
 * 5. STOP: Signals call termination
 * 
 * Phase 1.5+: Audio chunks are queued and streamed to Deepgram for real-time transcription.
 * Phase 3: Final transcripts trigger LLM reasoning for AI responses.
 * 
 * Pipeline:
 * Twilio → Audio Queue → Deepgram STT → Transcript Events → LLM Reasoning → AI Response
 */
export class StreamHandler {
  private sessions: Map<string, CallSession> = new Map();
  private debugStreams: Map<string, fs.WriteStream> = new Map();
  private llmClient: OpenRouterClient | null = null;
  private ttsClient: DeepgramTTS | null = null;
  private agentService: AgentService;

  constructor() {
    this.agentService = new AgentService();
    
    if (OPENROUTER_API_KEY) {
      this.llmClient = new OpenRouterClient({
        apiKey: OPENROUTER_API_KEY,
        model: 'openai/gpt-4o-mini',
      });
      logger.info('LLM client initialized');
    } else {
      logger.warn('OPENROUTER_API_KEY not set, LLM reasoning disabled');
    }

    if (DEEPGRAM_API_KEY) {
      this.ttsClient = new DeepgramTTS({
        apiKey: DEEPGRAM_API_KEY,
      });
      logger.info('TTS client initialized');
    } else {
      logger.warn('DEEPGRAM_API_KEY not set, TTS disabled');
    }
  }

  handleConnection(ws: WebSocket, connectionId: string): void {
    logger.info('WebSocket connection established', { connectionId });

    const tempSession: Partial<CallSession> = { ws };
    this.sessions.set(connectionId, tempSession as CallSession);

    ws.on('message', (message: Buffer) => {
      try {
        const event: TwilioEvent = JSON.parse(message.toString());
        this.handleEvent(ws, event, connectionId);
      } catch (error) {
        logger.error('Failed to parse message', { error, connectionId });
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed', { connectionId });
      this.cleanupSession(connectionId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, connectionId });
    });
  }

  private handleEvent(_ws: WebSocket, event: TwilioEvent, connectionId: string): void {
    switch (event.event) {
      case 'connected':
        this.handleConnected(event as TwilioConnectedEvent, connectionId);
        break;
      case 'start':
        this.handleStart(event as TwilioStartEvent, connectionId);
        break;
      case 'media':
        this.handleMedia(event as TwilioMediaEvent, connectionId);
        break;
      case 'dtmf':
        this.handleDtmf(event as TwilioDtmfEvent, connectionId);
        break;
      case 'stop':
        this.handleStop(event as TwilioStopEvent, connectionId);
        break;
      case 'mark':
        logger.debug('Mark event received', { streamSid: event.streamSid });
        break;
      default:
        logger.warn('Unknown event type', { event: (event as any).event });
    }
  }

  private handleConnected(event: TwilioConnectedEvent, connectionId: string): void {
    logger.info('Twilio stream connected', { 
      streamSid: event.streamSid,
      protocol: event.protocol,
      version: event.version,
      connectionId,
    });
  }

  private async handleStart(event: TwilioStartEvent, connectionId: string): Promise<void> {
    const { streamSid, start } = event;
    const { callSid, accountSid, tracks, mediaFormat, customParameters } = start;

    const toPhoneNumber = customParameters?.toPhoneNumber;

    const audioQueue = new AudioQueue(1000);

    const existingSession = this.sessions.get(connectionId);
    const ws = existingSession?.ws;

    const session: CallSession = {
      streamSid,
      callSid,
      accountSid,
      startedAt: new Date(),
      tracks,
      mediaFormat,
      audioQueue,
      conversationHistory: [],
      ws,
      isSpeaking: false,
      ttsAbortController: undefined,
      toPhoneNumber,
    };

    this.sessions.set(connectionId, session);

    logger.info('Call stream started', {
      callSid,
      streamSid,
      accountSid,
      tracks,
      encoding: mediaFormat.encoding,
      sampleRate: mediaFormat.sampleRate,
      toPhoneNumber,
    });

    if (toPhoneNumber) {
      await this.loadAgentForSession(session);
    } else {
      logger.warn('No toPhoneNumber provided, agent loading skipped', { callSid });
    }

    if (DEBUG_AUDIO) {
      this.initDebugRecording(callSid);
    }

    if (DEEPGRAM_API_KEY) {
      await this.initDeepgramStream(session, connectionId);
    } else {
      logger.warn('DEEPGRAM_API_KEY not set, STT disabled', { callSid });
    }
  }

  private async loadAgentForSession(session: CallSession): Promise<void> {
    if (!session.toPhoneNumber) {
      return;
    }

    try {
      const agent = await this.agentService.getAgentByPhoneNumber(session.toPhoneNumber);
      
      if (agent) {
        session.agent = agent;
        
        logger.info('[AGENT_LOADED]', {
          callSid: session.callSid,
          agentId: agent.id,
          agentName: agent.name,
          voice: agent.voice,
          temperature: agent.temperature,
        });

        if (this.llmClient) {
          this.llmClient.setSystemPrompt(agent.systemPrompt);
          this.llmClient.setTemperature(agent.temperature);
        }
      } else {
        logger.warn('No agent configured for phone number', {
          callSid: session.callSid,
          toPhoneNumber: session.toPhoneNumber,
        });
      }
    } catch (error) {
      logger.error('Failed to load agent', {
        callSid: session.callSid,
        toPhoneNumber: session.toPhoneNumber,
        error,
      });
    }
  }

  private async initDeepgramStream(session: CallSession, connectionId: string): Promise<void> {
    try {
      const deepgramStream = new DeepgramStream(session.callSid, {
        apiKey: DEEPGRAM_API_KEY,
        encoding: 'mulaw',
        sampleRate: 8000,
        channels: 1,
      });

      deepgramStream.onTranscript((result: TranscriptResult) => {
        this.handleTranscript(session.callSid, result);
      });

      await deepgramStream.connect();
      session.sttStream = deepgramStream;

      logger.info('Deepgram stream initialized', { callSid: session.callSid });

      this.startAudioStreamingLoop(session, connectionId);
    } catch (error) {
      logger.error('Failed to initialize Deepgram stream', { 
        callSid: session.callSid, 
        error 
      });
    }
  }

  private startAudioStreamingLoop(session: CallSession, connectionId: string): void {
    const streamAudio = () => {
      const currentSession = this.sessions.get(connectionId);
      
      if (!currentSession || !currentSession.sttStream) {
        return;
      }

      const chunk = currentSession.audioQueue.getNextChunk();
      
      if (chunk) {
        const success = currentSession.sttStream.sendAudio(chunk);
        
        if (!success) {
          logger.warn('Failed to send audio to Deepgram', { 
            callSid: session.callSid 
          });
        }
      }

      setImmediate(streamAudio);
    };

    streamAudio();
  }

  private async handleTranscript(callSid: string, result: TranscriptResult): Promise<void> {
    logger.info('[TRANSCRIPT]', {
      callSid,
      text: result.text,
      isFinal: result.isFinal,
      confidence: result.confidence,
    });

    if (result.isFinal && result.text.trim()) {
      await this.handleFinalTranscript(callSid, result.text);
    }
  }

  /**
   * Handle FINAL transcripts by triggering LLM reasoning
   * 
   * Phase 3 Pipeline:
   * 1. User speaks → Deepgram transcribes (FINAL)
   * 2. Add transcript to conversation history as "user" role
   * 3. Send conversation history to LLM
   * 4. Receive AI response
   * 5. Add response to conversation history as "assistant" role
   * 6. Log AI response
   * 
   * Concurrency:
   * - Each call session has its own conversation history
   * - Multiple calls can run concurrently without interference
   * - Async/await ensures non-blocking operation
   */
  private async handleFinalTranscript(callSid: string, text: string): Promise<void> {
    if (!this.llmClient) {
      logger.debug('LLM client not available, skipping response generation', { callSid });
      return;
    }

    const session = Array.from(this.sessions.values()).find(s => s.callSid === callSid);
    
    if (!session) {
      logger.warn('Session not found for final transcript', { callSid });
      return;
    }

    const userMessage: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    session.conversationHistory.push(userMessage);

    try {
      const llmMessages: Message[] = session.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const aiResponse = await this.llmClient.generateResponse(
        llmMessages,
        session.agent?.systemPrompt,
        session.agent?.temperature
      );

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      session.conversationHistory.push(assistantMessage);

      logger.info('[AI_RESPONSE]', {
        callSid,
        text: aiResponse,
      });

      if (this.ttsClient && session.ws) {
        const voice = session.agent?.voice || 'aura-asteria-en';
        await this.ttsClient.speak(session, aiResponse, session.ws, voice);
      } else {
        if (!this.ttsClient) {
          logger.debug('TTS client not available, skipping speech synthesis', { callSid });
        }
        if (!session.ws) {
          logger.warn('WebSocket not available in session, cannot send TTS audio', { callSid });
        }
      }
    } catch (error) {
      logger.error('Failed to generate AI response', { 
        callSid, 
        error 
      });
    }
  }

  private initDebugRecording(callSid: string): void {
    const filename = path.join(DEBUG_AUDIO_DIR, `${callSid}.raw`);
    const writeStream = fs.createWriteStream(filename);
    
    this.debugStreams.set(callSid, writeStream);
    
    logger.info('Debug audio recording started', { 
      callSid, 
      file: filename,
      conversionHelp: 'Convert to WAV: sox -t ul -r 8000 -c 1 <file>.raw <file>.wav',
    });
  }

  private handleDtmf(event: TwilioDtmfEvent, connectionId: string): void {
    const session = this.sessions.get(connectionId);
    
    logger.info('DTMF digit received', {
      callSid: session?.callSid,
      digit: event.dtmf.digit,
      track: event.dtmf.track,
    });
  }

  private handleMedia(event: TwilioMediaEvent, connectionId: string): void {
    const session = this.sessions.get(connectionId);
    
    if (!session) {
      logger.warn('Media event received for unknown session', { connectionId });
      return;
    }

    const { media, sequenceNumber } = event;
    
    /**
     * Audio Decoding:
     * - Twilio sends audio as base64-encoded μ-law (G.711) format
     * - Each chunk represents ~20ms of audio (160 bytes)
     * - Sample rate: 8000 Hz, mono channel
     * 
     * Pipeline:
     * 1. Decode base64 to binary μ-law buffer
     * 2. Push to audio queue for STT processing
     * 3. Optionally write to debug recording
     * 
     * We only process inbound track (caller audio) for STT.
     * Outbound track (AI responses) will be used in Phase 4 (TTS).
     * 
     * Phase 5 - Barge-in Detection:
     * If AI is speaking (isSpeaking = true) and user audio is detected,
     * trigger interruption to stop TTS immediately.
     */
    const audioBuffer = Buffer.from(media.payload, 'base64');

    const chunk: AudioChunk = {
      track: media.track,
      timestamp: media.timestamp,
      payload: audioBuffer,
      sequenceNumber,
    };

    logger.debug('Audio chunk received', {
      callSid: session.callSid,
      track: chunk.track,
      sequenceNumber: chunk.sequenceNumber,
      payloadSize: audioBuffer.length,
      timestamp: chunk.timestamp,
      queueSize: session.audioQueue.size(),
    });

    if (chunk.track === 'inbound') {
      if (session.isSpeaking && audioBuffer.length > 0) {
        this.handleBargeIn(session);
      }

      const pushed = session.audioQueue.push(audioBuffer);
      
      if (!pushed) {
        logger.warn('Audio queue full, dropping chunk', {
          callSid: session.callSid,
          sequenceNumber,
        });
      }

      if (DEBUG_AUDIO) {
        const debugStream = this.debugStreams.get(session.callSid);
        if (debugStream) {
          debugStream.write(audioBuffer);
        }
      }
    }
  }

  private async handleStop(_event: TwilioStopEvent, connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);

    if (!session) {
      logger.warn('Stop event received for unknown session', { connectionId });
      return;
    }

    const duration = Date.now() - session.startedAt.getTime();

    logger.info('Call stream ended', {
      callSid: session.callSid,
      streamSid: session.streamSid,
      duration: `${Math.floor(duration / 1000)}s`,
    });

    await this.cleanupSession(connectionId);
  }

  private handleBargeIn(session: CallSession): void {
    logger.info('[BARGE_IN]', {
      callSid: session.callSid,
      reason: 'user_speech_detected',
    });

    if (session.ttsAbortController) {
      session.ttsAbortController.abort();
    }

    if (this.ttsClient) {
      this.ttsClient.abort(session.callSid);
      this.ttsClient.clearQueue(session.callSid);
    }

    session.isSpeaking = false;
  }

  private async cleanupSession(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    
    if (session) {
      logger.debug('Cleaning up session', { 
        callSid: session.callSid,
        connectionId 
      });

      if (session.sttStream) {
        await session.sttStream.close();
        logger.info('Deepgram stream closed', { callSid: session.callSid });
      }

      if (this.ttsClient && session.callSid) {
        this.ttsClient.cleanup(session.callSid);
      }

      session.audioQueue.clear();

      if (DEBUG_AUDIO) {
        const debugStream = this.debugStreams.get(session.callSid);
        if (debugStream) {
          debugStream.end();
          this.debugStreams.delete(session.callSid);
          logger.info('Debug recording saved', { callSid: session.callSid });
        }
      }

      this.sessions.delete(connectionId);
    }
  }

  getActiveSessions(): number {
    return this.sessions.size;
  }
}
