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
import { SarvamStream } from '../stt/sarvamStream';
import { ElevenLabsStream } from '../stt/elevenlabsStream';
import { LocalStream } from '../stt/localStream';
import { OpenRouterClient, Message, OpenRouterToolCall } from '../llm/openrouterClient';
import { DeepgramTTS } from '../tts/deepgramTTS';
import { ElevenLabsTTS } from '../tts/elevenlabsTTS';
import { CartesiaTTS } from '../tts/cartesiaTTS';
import { SarvamTTS } from '../tts/sarvamTTS';
import { LocalTTS, checkLocalVoiceServerHealth } from '../tts/localTTS';
import { AgentService } from '../agents/agentService';
import { KnowledgeService } from '../knowledge/knowledgeService';
import { ToolService } from '../tools/toolService';
import { toolRegistry } from '../tools/toolRegistry';
import { toolExecutor } from '../tools/toolExecutor';
import { CallService } from '../analytics/callService';
import { MessageService } from '../analytics/messageService';
import { ToolEventService } from '../analytics/toolEventService';
import { CustomerService } from '../customers/customerService';
import { UsageService } from '../billing/usageService';

const logger = createLogger('StreamHandler');

const DEBUG_AUDIO = process.env.DEBUG_AUDIO === 'true';
// In-house Voice AI server (Piper TTS + faster-whisper STT) — the LOCAL provider.
const VOICE_AI_BASE_URL = process.env.VOICE_AI_BASE_URL || 'http://localhost:8000';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || '';
const ENABLE_BARGE_IN = process.env.ENABLE_BARGE_IN === 'true';
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
  private agentService: AgentService;
  private knowledgeService: KnowledgeService;
  private toolService: ToolService;
  private callService: CallService;
  private messageService: MessageService;
  private toolEventService: ToolEventService;
  private customerService: CustomerService;
  private usageService: UsageService;

  constructor() {
    this.agentService = new AgentService();
    this.knowledgeService = new KnowledgeService();
    this.toolService = new ToolService();
    this.callService = new CallService();
    this.messageService = new MessageService();
    this.toolEventService = new ToolEventService();
    this.customerService = new CustomerService();
    this.usageService = new UsageService();

    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
    // STT/TTS are initialized per-session from agent config.

    if (openRouterApiKey) {
      this.llmClient = new OpenRouterClient({
        apiKey: openRouterApiKey,
        model: 'openai/gpt-4o-mini',
      });
      logger.info('LLM client initialized', {
        openRouterKeyPresent: true,
        openRouterKeyLength: openRouterApiKey.length,
        openRouterKeyLast4: openRouterApiKey.slice(-4),
      });
    } else {
      logger.warn('OPENROUTER_API_KEY not set, LLM reasoning disabled');
    }

    // (kept) Deepgram key presence will be checked on selection/fallback.
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
    const fromPhoneNumber = customParameters?.fromPhoneNumber;
    const agentId = customParameters?.agentId;

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
      isResponding: false,
      hasRespondedToCurrentUtterance: false,
      ttsAbortController: undefined,
      toPhoneNumber,
      fromPhoneNumber,
      sttSeconds: 0,
      ttsSeconds: 0,
      llmTokens: 0,
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
      fromPhoneNumber,
    });

    if (DEBUG_AUDIO) {
      this.initDebugRecording(callSid);
    }

    // Start STT immediately; don't block on any DB work.
    // Default starts with LOCAL (in-house, no API key needed); if the agent
    // selects another provider, we'll restart after load.
    void this.initSttStream(session, connectionId);

    // TTS greeting is emitted after agent loads (so provider selection is honored).

    // Load agent + customer + analytics in the background.
    void (async () => {
      await this.loadAgentForSession(session, agentId);

      await this.selectProvidersForSession(session, connectionId);

      // Log comprehensive call configuration after all providers are selected
      this.logCallConfiguration(session);

      // Speak a greeting once TTS is selected to confirm outbound audio works.
      if (session.ttsClient && ws && ws.readyState === WebSocket.OPEN) {
        const initialGreeting =
          'Hi, this is your Bolna AI agent. I am just a test right now to confirm audio is working.';
        try {
          const voice = session.agent?.voice || 'aura-asteria-en';
          const model = (session.agent as any)?.ttsModel || undefined;
          await session.ttsClient.speak(session, initialGreeting, ws, voice, model);
        } catch (error) {
          logger.error('Failed to speak initial greeting', { callSid, error });
        }
      }

      // If agent has a welcomeMessage configured, queue it after the initial greeting.
      const welcomeMessage = session.agent?.welcomeMessage;
      const wsForTts = session.ws;

      if (welcomeMessage && session.ttsClient && wsForTts && wsForTts.readyState === WebSocket.OPEN) {
        try {
          const voice = session.agent?.voice || 'aura-asteria-en';
          const model = (session.agent as any)?.ttsModel || undefined;
          await session.ttsClient.speak(session, welcomeMessage, wsForTts, voice, model);
        } catch (error) {
          logger.error('Failed to speak welcome message', { callSid, error });
        }
      }

      // Continue the rest of session bootstrapping without delaying audio.
      const phoneForCustomer = fromPhoneNumber || toPhoneNumber || '';

      if (phoneForCustomer) {
        try {
          const customer = await this.customerService.getOrCreateCustomer(phoneForCustomer);

          if (customer) {
            session.customerId = customer.id;

            logger.info('[CUSTOMER_LOADED]', {
              customerId: customer.id,
              phone: customer.phone,
            });

            try {
              const historySummary = await this.customerService.getCustomerHistorySummary(customer.id);
              session.customerHistorySummary = historySummary;
            } catch (error) {
              logger.error('Failed to load customer history summary', {
                callSid,
                customerId: customer.id,
                error,
              });
            }
          }
        } catch (error) {
          logger.error('Failed to load or create customer for call', {
            callSid,
            phone: phoneForCustomer,
            error,
          });
        }
      } else {
        logger.warn('No phone number available for customer resolution', { callSid });
      }

      try {
        const phoneForCall = fromPhoneNumber || toPhoneNumber || 'unknown';
        const agentIdForCall = session.agent?.id;
        const callRecord = await this.callService.createCall({
          callSid,
          phone: phoneForCall,
          agentId: agentIdForCall,
        });
        session.callId = callRecord.id;

        if (session.callId && session.customerId) {
          try {
            await this.customerService.attachCallToCustomer(session.callId, session.customerId);
          } catch (error) {
            logger.error('Failed to attach call to customer', {
              callSid,
              callId: session.callId,
              customerId: session.customerId,
              error,
            });
          }
        }
      } catch (error) {
        logger.error('Failed to create call analytics record', {
          callSid,
          error,
        });
      }
    })();
  }

  private async loadAgentForSession(session: CallSession, agentIdFromParams?: string): Promise<void> {
    try {
      let agent = null;

      if (agentIdFromParams) {
        agent = await this.agentService.getAgentById(agentIdFromParams);

        if (!agent) {
          logger.warn('No agent found for agentId from stream parameters', {
            callSid: session.callSid,
            agentId: agentIdFromParams,
          });
        }
      }

      if (!agent && session.toPhoneNumber) {
        agent = await this.agentService.getAgentByPhoneNumber(session.toPhoneNumber);
      }

      if (!agent) {
        logger.warn('No agent configured for session', {
          callSid: session.callSid,
          toPhoneNumber: session.toPhoneNumber,
          agentIdFromParams,
        });
        return;
      }

      session.agent = agent;
      session.agentConfig = agent;

      session.interruptWords = agent.interruptWords ?? 2;
      session.silenceTimeout = agent.silenceTimeout ?? 30;
      session.maxCallDuration = agent.maxCallDuration ?? 600;
      session.responseLatency = agent.responseLatency ?? 0;
      session.endpointingMs = agent.endpointingMs ?? 1000;
      session.finalCallMessage = agent.finalCallMessage ?? undefined;

      logger.info('[AGENT_LOADED]', {
        callSid: session.callSid,
        agentId: agent.id,
        agentName: agent.name,
        voice: agent.voice,
        temperature: agent.temperature,
      });

      logger.info('[AGENT_CONFIG_LOADED]', {
        callSid: session.callSid,
        agentId: agent.id,
        voice: agent.voice,
        sttProvider: agent.sttProvider,
        language: agent.language,
        interruptWords: agent.interruptWords,
        silenceTimeout: agent.silenceTimeout,
      });

      if (this.llmClient) {
        const basePrompt = agent.systemPrompt ?? 'You are a helpful voice agent.';
        const language = (agent.language ?? '').trim();
        const languageGuard = language
          ? `\n\nLANGUAGE REQUIREMENT:\n- You MUST respond only in ${language}.\n- Even if the user speaks another language, keep your responses strictly in ${language}.\n- Do not include translations or mixed-language output.\n`
          : '';

        this.llmClient.setSystemPrompt(`${basePrompt}${languageGuard}`);
        this.llmClient.setTemperature(agent.temperature ?? 0.3);
        
        const llmModel = (agent as any).llmModel || 'openai/gpt-4o-mini';
        const llmProvider = (agent as any).llmProvider || 'openrouter';
        logger.info('[LLM_PROVIDER_CONFIGURED]', {
          provider: llmProvider,
          model: llmModel,
          temperature: agent.temperature ?? 0.3,
          callSid: session.callSid,
        });
      }

      try {
        await this.toolService.loadToolsForAgent(agent.id);
      } catch (error) {
        logger.error('Failed to load tools for agent', {
          agentId: agent.id,
          error,
        });
      }
    } catch (error) {
      logger.error('Failed to load agent for session', {
        callSid: session.callSid,
        toPhoneNumber: session.toPhoneNumber,
        agentIdFromParams,
        error,
      });
    }
  }

  private async initSttStream(session: CallSession, connectionId: string): Promise<void> {
    const agentProviderRaw = (session.agent?.sttProvider as any) ?? 'LOCAL';
    const provider = String(agentProviderRaw).toUpperCase();

    try {
      if (provider === 'LOCAL') {
        const localStream = new LocalStream(session.callSid, {
          baseUrl: VOICE_AI_BASE_URL,
          silenceThresholdMs: session.agent?.endpointingMs ?? session.endpointingMs ?? 1000,
        });

        localStream.onTranscript((result: TranscriptResult) => this.handleTranscript(session.callSid, result));
        await localStream.connect();

        session.sttClient = localStream;
        session.sttStream = localStream;
        session.sttProviderName = 'LOCAL';

        logger.info('[STT_PROVIDER_SELECTED]', {
          provider: 'local',
          model: 'faster-whisper',
          baseUrl: VOICE_AI_BASE_URL,
          language: session.agent?.language,
          callSid: session.callSid
        });
        this.startAudioStreamingLoop(session, connectionId);
        return;
      }

      if (provider === 'SARVAM') {
        if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set');

        const sarvamStream = new SarvamStream(session.callSid, {
          apiKey: SARVAM_API_KEY,
          encoding: 'mulaw',
          sampleRate: 8000,
          channels: 1,
          model: (session.agent as any)?.sttModel || 'saaras:v3',
          languageCode: session.agent?.language ?? undefined,
        });

        sarvamStream.onTranscript((result: TranscriptResult) => this.handleTranscript(session.callSid, result));
        await sarvamStream.connect();

        session.sttClient = sarvamStream;
        session.sttStream = sarvamStream;
        session.sttProviderName = 'SARVAM';

        const sttModel = (session.agent as any)?.sttModel || 'saaras:v3';
        logger.info('[STT_PROVIDER_SELECTED]', {
          provider: 'sarvam',
          model: sttModel,
          language: session.agent?.language,
          callSid: session.callSid
        });
        this.startAudioStreamingLoop(session, connectionId);
        return;
      }

      if (provider === 'ELEVENLABS') {
        if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');

        const elevenStream = new ElevenLabsStream(session.callSid, {
          apiKey: ELEVENLABS_API_KEY,
          model: (session.agent as any)?.sttModel || 'scribe_v2_realtime',
          languageCode: session.agent?.language ?? undefined,
          audioFormat: 'ulaw_8000',
          commitStrategy: 'vad',
        });

        elevenStream.onTranscript((result: TranscriptResult) => this.handleTranscript(session.callSid, result));
        await elevenStream.connect();

        session.sttClient = elevenStream;
        session.sttStream = elevenStream;
        session.sttProviderName = 'ELEVENLABS';

        const sttModel = (session.agent as any)?.sttModel || 'scribe_v2_realtime';
        logger.info('[STT_PROVIDER_SELECTED]', { 
          provider: 'elevenlabs', 
          model: sttModel,
          language: session.agent?.language,
          callSid: session.callSid 
        });
        this.startAudioStreamingLoop(session, connectionId);
        return;
      }

      await this.initDeepgramStream(session, connectionId);
    } catch (error) {
      if (DEEPGRAM_API_KEY) {
        logger.warn('[STT_PROVIDER_FALLBACK]', {
          callSid: session.callSid,
          requestedProvider: provider,
          fallback: 'deepgram',
          error,
        });
        await this.initDeepgramStream(session, connectionId);
      } else {
        logger.error('[STT_PROVIDER_FAILED_NO_FALLBACK]', {
          callSid: session.callSid,
          requestedProvider: provider,
          error,
        });
      }
    }
  }

  private async initDeepgramStream(session: CallSession, connectionId: string): Promise<void> {
    if (!DEEPGRAM_API_KEY) {
      logger.error('DEEPGRAM_API_KEY not set, cannot initialize Deepgram STT', {
        callSid: session.callSid,
      });
      return;
    }

    try {
      const deepgramStream = new DeepgramStream(session.callSid, {
        apiKey: DEEPGRAM_API_KEY,
        encoding: 'mulaw',
        sampleRate: 8000,
        channels: 1,
        language: session.agent?.language ?? undefined,
      });

      deepgramStream.onTranscript((result: TranscriptResult) => {
        this.handleTranscript(session.callSid, result);
      });

      await deepgramStream.connect();
      session.sttClient = deepgramStream;
      session.sttStream = deepgramStream;
      session.sttProviderName = 'DEEPGRAM';

      logger.info('[STT_PROVIDER_SELECTED]', { 
        provider: 'deepgram',
        model: 'nova-2',
        language: session.agent?.language,
        callSid: session.callSid 
      });

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

      if (!currentSession || !currentSession.sttClient) {
        return;
      }

      const chunk = currentSession.audioQueue.getNextChunk();

      if (chunk) {
        currentSession.lastAudioTimestamp = Date.now();

        if (!currentSession.firstAudioTimestamp) {
          currentSession.firstAudioTimestamp = Date.now();
        }

        const success = currentSession.sttClient.sendAudio(chunk);

        if (!success) {
          logger.warn('Failed to send audio to STT provider', {
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

    const session = Array.from(this.sessions.values()).find((s) => s.callSid === callSid);
    if (!session) return;

    if (result.isFinal && result.text.trim()) {
      if (session.partialDebounceTimer) {
        clearTimeout(session.partialDebounceTimer);
        session.partialDebounceTimer = undefined;
      }

      // Early check: if already responding, ignore
      if (session.isResponding) {
        logger.info('[TRANSCRIPT_IGNORED_ALREADY_RESPONDING]', { callSid, text: result.text });
        return;
      }

      // Check if partial already triggered response for this utterance
      if (session.hasRespondedToCurrentUtterance) {
        logger.info('[TRANSCRIPT_IGNORED_ALREADY_RESPONDED_TO_UTTERANCE]', { callSid, text: result.text });
        return;
      }

      await this.handleFinalTranscript(callSid, result.text, result.confidence);
    } else if (!result.isFinal && result.text.trim()) {
      this.handlePartialTranscript(callSid, result.text, result.confidence);
    }
  }

  private handlePartialTranscript(callSid: string, text: string, confidence?: number): void {
    const session = Array.from(this.sessions.values()).find((s) => s.callSid === callSid);
    if (!session) return;

    // Early exit if already responding or already responded to current utterance
    if (session.isResponding || session.hasRespondedToCurrentUtterance) {
      return;
    }

    const wordCount = text.trim().split(/\s+/).length;
    const MIN_WORDS = 6;
    const MIN_CONFIDENCE = 0.75;
    const TRANSCRIPT_DEBOUNCE_MS = 400;
    const AUDIO_SILENCE_MS = 400;
    const MIN_SPEECH_DURATION_MS = 600;

    if (wordCount < MIN_WORDS) {
      return;
    }

    if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
      return;
    }

    const transcriptChanged = session.lastPartialTranscript !== text;
    session.lastPartialTranscript = text;
    session.lastPartialTimestamp = Date.now();

    if (transcriptChanged) {
      session.partialTranscriptChangeCount = (session.partialTranscriptChangeCount || 0) + 1;
    }

    if (session.partialDebounceTimer) {
      clearTimeout(session.partialDebounceTimer);
    }

    session.partialDebounceTimer = setTimeout(() => {
      // Double-check before triggering
      if (session.isResponding || session.hasRespondedToCurrentUtterance) return;

      const now = Date.now();
      const timeSinceLastPartial = now - (session.lastPartialTimestamp || 0);
      const timeSinceLastAudio = now - (session.lastAudioTimestamp || 0);
      const speechDuration = now - (session.firstAudioTimestamp || now);

      if (speechDuration < MIN_SPEECH_DURATION_MS) {
        logger.debug('[PARTIAL_TRANSCRIPT_IGNORED_TOO_SHORT_SPEECH]', {
          callSid,
          speechDuration,
          minRequired: MIN_SPEECH_DURATION_MS,
        });
        return;
      }

      if (timeSinceLastAudio < AUDIO_SILENCE_MS) {
        logger.debug('[PARTIAL_TRANSCRIPT_IGNORED_AUDIO_STILL_ACTIVE]', {
          callSid,
          timeSinceLastAudio,
          minRequired: AUDIO_SILENCE_MS,
        });
        return;
      }

      const lastChar = text.trim().slice(-1);
      const endsCleanly = lastChar === ' ' || /[.!?,;:]/.test(lastChar) || text.trim().endsWith(' ');

      if (!endsCleanly && (session.partialTranscriptChangeCount || 0) < 2) {
        logger.debug('[PARTIAL_TRANSCRIPT_IGNORED_MID_WORD]', {
          callSid,
          lastChar,
          changeCount: session.partialTranscriptChangeCount,
        });
        return;
      }

      if (timeSinceLastPartial >= TRANSCRIPT_DEBOUNCE_MS && session.lastPartialTranscript) {
        logger.info('[PARTIAL_TRANSCRIPT_TRIGGERED_EARLY_RESPONSE]', {
          callSid,
          text: session.lastPartialTranscript,
          wordCount,
          confidence,
          timeSinceLastPartial,
          timeSinceLastAudio,
          speechDuration,
        });

        session.partialTranscriptChangeCount = 0;
        session.firstAudioTimestamp = undefined;

        void this.handleFinalTranscript(callSid, session.lastPartialTranscript, confidence);
      }
    }, TRANSCRIPT_DEBOUNCE_MS);
  }

  /**
   * Handle FINAL transcripts by triggering LLM reasoning + tools
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
  private async handleFinalTranscript(callSid: string, text: string, confidence?: number): Promise<void> {
    if (!this.llmClient) {
      logger.debug('LLM client not available, skipping response generation', { callSid });
      return;
    }

    const session = Array.from(this.sessions.values()).find((s) => s.callSid === callSid);

    if (!session) {
      logger.warn('Session not found for final transcript', { callSid });
      return;
    }

    // CRITICAL: Set isResponding IMMEDIATELY before any async work to prevent race conditions
    if (session.isResponding) {
      logger.info('[TRANSCRIPT_IGNORED_ALREADY_RESPONDING]', { callSid, text });
      return;
    }

    // Check if we already responded to this utterance (from partial trigger)
    if (session.hasRespondedToCurrentUtterance) {
      logger.info('[TRANSCRIPT_IGNORED_ALREADY_RESPONDED_TO_UTTERANCE]', { callSid, text });
      return;
    }

    // Set both flags IMMEDIATELY to prevent any duplicate responses
    session.isResponding = true;
    session.hasRespondedToCurrentUtterance = true;

    if (session.partialDebounceTimer) {
      clearTimeout(session.partialDebounceTimer);
      session.partialDebounceTimer = undefined;
    }

    const userMessage: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    session.conversationHistory.push(userMessage);

    if (session.callId) {
      try {
        await this.messageService.storeMessage(session.callId, 'user', text, confidence);
      } catch (error) {
        logger.error('Failed to persist user message', {
          callSid,
          callId: session.callId,
          error,
        });
      }
    }

    try {
      const historyMessages: Message[] = session.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      let knowledgeContext: string | undefined;

      if (session.agent) {
        try {
          const docs = await this.knowledgeService.searchRelevantDocs(session.agent.id, text, 3);
          if (docs.length > 0) {
            knowledgeContext = docs.map((d) => d.content).join('\n---\n');
          }
        } catch (error) {
          logger.error('Knowledge retrieval failed', { callSid, error });
        }
      }

      let systemPrompt = session.agent?.systemPrompt ?? this.llmClient.getSystemPrompt();

      const voiceOptimizationPrompt = `

VOICE CONVERSATION RULES (CRITICAL):
- Keep responses SHORT: 1-2 sentences maximum (15-25 words ideal)
- Use conversational, natural tone - speak like a helpful human
- Use short sentences with commas for natural pauses
- Avoid long explanations, lists, or formal language
- You can use occasional fillers: "Sure," "Got it," "Let me check," but don't overuse
- Break information into bite-sized pieces

GOOD: "Sure, we offer cardiology care. Emergency services are available 24/7."
BAD: "Our hospital provides comprehensive cardiology services including diagnostic testing, interventional procedures, and cardiac rehabilitation programs."

Remember: This is a PHONE CALL. Be concise and natural.`;

      systemPrompt = systemPrompt + voiceOptimizationPrompt;

      const baseMessages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...(session.customerHistorySummary
          ? [
            {
              role: 'system',
              content: session.customerHistorySummary,
            } as Message,
          ]
          : []),
        ...(knowledgeContext
          ? [
            {
              role: 'system',
              content: `Knowledge Context:\n${knowledgeContext}`,
            } as Message,
          ]
          : []),
        ...historyMessages,
      ];

      const tools = session.agent
        ? toolRegistry.getToolsForAgent(session.agent.id).map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }))
        : [];

      let finalText: string | null = null;

      // If no tools are configured for this agent, we can stream LLM → TTS for lower latency.
      if (tools.length === 0 && session.ttsClient && session.ws) {
        const voice = session.agent?.voice || 'aura-asteria-en';
        const model = (session.agent as any)?.ttsModel || undefined;

        let buffered = '';
        const MAX_CHUNK_LENGTH = 120;

        session.ttsClient.startStream(session);

        const flushChunk = (chunk: string) => {
          const trimmed = chunk.trim();
          if (trimmed.length > 0) {
            void session.ttsClient.sendChunk(session, trimmed, session.ws!, voice, model);
          }
        };

        logger.debug('[LLM_REQUEST_STREAMING]', {
          callSid,
          model: (session.agent as any)?.llmModel || 'openai/gpt-4o-mini',
          temperature: session.agent?.temperature ?? 0.3,
          messageCount: baseMessages.length,
        });

        const { fullText } = await this.llmClient.generateChatStream(
          {
            messages: baseMessages,
            temperature: session.agent?.temperature ?? undefined,
          },
          (deltaText: string) => {
            buffered += deltaText;

            // Flush on sentence boundaries or comma pauses.
            if (
              buffered.endsWith('.') ||
              buffered.endsWith('?') ||
              buffered.endsWith('!') ||
              buffered.endsWith('\n')
            ) {
              flushChunk(buffered);
              buffered = '';
            } else if (buffered.includes(',')) {
              // Flush up to and including the comma for natural pauses.
              const commaIdx = buffered.lastIndexOf(',');
              const chunk = buffered.slice(0, commaIdx + 1);
              buffered = buffered.slice(commaIdx + 1);
              flushChunk(chunk);
            } else if (buffered.length > MAX_CHUNK_LENGTH) {
              // Fallback: avoid holding too much text without speaking.
              flushChunk(buffered);
              buffered = '';
            }
          },
        );

        finalText = fullText || '';

        if (buffered.trim().length > 0) {
          flushChunk(buffered);
        }

        session.ttsClient.endStream(session);
      } else {
        // Fallback to non-streaming LLM flow (including tool calls).
        logger.debug('[LLM_REQUEST_NON_STREAMING]', {
          callSid,
          model: (session.agent as any)?.llmModel || 'openai/gpt-4o-mini',
          temperature: session.agent?.temperature ?? 0.3,
          messageCount: baseMessages.length,
          toolsCount: tools.length,
        });

        const firstResponse = await this.llmClient.generateChat({
          messages: baseMessages,
          temperature: session.agent?.temperature ?? undefined,
          tools,
        });

        const firstChoice = firstResponse.choices[0];
        const firstMessage = firstChoice.message;

        finalText = firstMessage.content ?? null;

        if (firstResponse.usage?.total_tokens) {
          session.llmTokens = (session.llmTokens || 0) + firstResponse.usage.total_tokens;
        }

        if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0 && session.agent) {
          const toolMessages: Message[] = [];

          for (const toolCall of firstMessage.tool_calls as OpenRouterToolCall[]) {
            try {
              const args = JSON.parse(toolCall.function.arguments || '{}');

              const call = {
                name: toolCall.function.name,
                arguments: args as Record<string, unknown>,
              };

              const result = await toolExecutor.executeTool(session.agent.id, call);

              const toolMessage: Message = {
                role: 'tool',
                content: JSON.stringify(result),
                name: toolCall.function.name,
                tool_call_id: toolCall.id,
              };

              toolMessages.push(toolMessage);

              if (session.callId) {
                try {
                  await this.toolEventService.storeToolEvent(
                    session.callId,
                    toolCall.function.name,
                    args,
                    result,
                  );
                } catch (error) {
                  logger.error('Failed to persist tool event', {
                    callSid,
                    callId: session.callId,
                    toolName: toolCall.function.name,
                    error,
                  });
                }
              }
            } catch (error) {
              logger.error('Failed to execute tool from LLM', {
                callSid,
                error,
              });
            }
          }

          const followupMessages: Message[] = [
            ...baseMessages,
            {
              role: 'assistant',
              content: firstMessage.content ?? '',
            },
            ...toolMessages,
          ];

          const secondResponse = await this.llmClient.generateChat({
            messages: followupMessages,
            temperature: session.agent?.temperature ?? undefined,
          });

          const secondChoice = secondResponse.choices[0];
          finalText = secondChoice.message.content ?? '';

          if (secondResponse.usage?.total_tokens) {
            session.llmTokens = (session.llmTokens || 0) + secondResponse.usage.total_tokens;
          }
        }
      }

      let aiResponse = finalText ?? '';

      aiResponse = this.formatResponseForVoice(aiResponse);

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      session.conversationHistory.push(assistantMessage);

      if (session.callId) {
        try {
          await this.messageService.storeMessage(session.callId, 'assistant', aiResponse);
        } catch (error) {
          logger.error('Failed to persist assistant message', {
            callSid,
            callId: session.callId,
            error,
          });
        }
      }

      logger.info('[AI_RESPONSE]', {
        callSid,
        text: aiResponse,
      });

      // If we already streamed LLM → TTS above, avoid replaying the whole message again.
      if (tools.length > 0 && session.ttsClient && session.ws) {
        await this.speakProgressively(session, aiResponse);
      } else if (!session.ttsClient || !session.ws) {
        if (!session.ttsClient) {
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
    } finally {
      // Reset isResponding to allow next response
      session.isResponding = false;
      
      // NOTE: hasRespondedToCurrentUtterance is reset by TTS implementations
      // when they finish speaking (in processQueue when queue is empty)
      // This ensures the flag is only reset AFTER the agent finishes speaking
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
      if (ENABLE_BARGE_IN && session.isSpeaking && audioBuffer.length > 0) {
        this.handleBargeIn(session);
      }

      // Reset utterance flag when new audio arrives after silence
      // This indicates a new user utterance is starting
      const now = Date.now();
      const timeSinceLastAudio = now - (session.lastAudioTimestamp || 0);
      const SILENCE_THRESHOLD_MS = 1000; // 1 second of silence indicates new utterance
      
      if (timeSinceLastAudio > SILENCE_THRESHOLD_MS && session.hasRespondedToCurrentUtterance) {
        logger.debug('[NEW_UTTERANCE_DETECTED]', {
          callSid: session.callSid,
          timeSinceLastAudio,
        });
        session.hasRespondedToCurrentUtterance = false;
      }

      const pushed = session.audioQueue.push(audioBuffer);

      if (pushed) {
        const seconds = audioBuffer.length / 8000;
        session.sttSeconds = (session.sttSeconds || 0) + seconds;
      }

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
      durationMs: duration,
    });

    if (session.callSid) {
      try {
        const call = await this.callService.endCall(session.callSid);

        const organizationId = call?.organizationId || session.agent?.organizationId;
        if (organizationId) {
          const callMinutes = Math.max(duration / 1000 / 60, 0);
          const sttSeconds = session.sttSeconds || 0;
          const ttsSeconds = session.ttsSeconds || 0;
          const llmTokens = session.llmTokens || 0;

          // Fire-and-forget usage recording to avoid blocking pipeline shutdown
          (async () => {
            try {
              await this.usageService.recordUsage(organizationId, 'call_minutes', callMinutes);
              if (sttSeconds > 0) {
                await this.usageService.recordUsage(organizationId, 'stt_seconds', sttSeconds);
              }
              if (ttsSeconds > 0) {
                await this.usageService.recordUsage(organizationId, 'tts_seconds', ttsSeconds);
              }
              if (llmTokens > 0) {
                await this.usageService.recordUsage(organizationId, 'llm_tokens', llmTokens);
              }
            } catch (error) {
              logger.error('Failed to record usage for call', {
                callSid: session.callSid,
                organizationId,
                error,
              });
            }
          })();
        }
      } catch (error) {
        logger.error('Failed to end call analytics record', {
          callSid: session.callSid,
          error,
        });
      }
    }

    await this.cleanupSession(connectionId);
  }

  private handleBargeIn(session: CallSession): void {
    logger.info('[BARGE_IN]', {
      callSid: session.callSid,
      reason: 'user_speech_detected',
    });

    // Abort current TTS
    if (session.ttsAbortController) {
      session.ttsAbortController.abort();
    }

    if (session.ttsClient) {
      session.ttsClient.abort(session.callSid);
      session.ttsClient.clearQueue(session.callSid);
    }

    session.isSpeaking = false;

    // Clear any pending timers
    if (session.partialDebounceTimer) {
      clearTimeout(session.partialDebounceTimer);
      session.partialDebounceTimer = undefined;
    }

    // Reset response flags - new user utterance is starting
    session.isResponding = false;
    session.hasRespondedToCurrentUtterance = false;
    session.partialTranscriptChangeCount = 0;
    session.firstAudioTimestamp = undefined;
    
    logger.debug('[BARGE_IN_FLAGS_RESET]', {
      callSid: session.callSid,
      isResponding: session.isResponding,
      hasRespondedToCurrentUtterance: session.hasRespondedToCurrentUtterance,
    });
  }

  private formatResponseForVoice(text: string): string {
    if (!text) return text;

    let formatted = text.trim();

    const MAX_WORDS = 50;
    const words = formatted.split(/\s+/);
    
    if (words.length > MAX_WORDS) {
      const sentences = formatted.match(/[^.!?]+[.!?]+/g) || [formatted];
      
      let truncated = '';
      let wordCount = 0;
      
      for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        if (wordCount + sentenceWords <= MAX_WORDS) {
          truncated += sentence;
          wordCount += sentenceWords;
        } else {
          break;
        }
      }
      
      if (truncated) {
        formatted = truncated.trim();
      } else {
        formatted = words.slice(0, MAX_WORDS).join(' ') + '.';
      }
      
      logger.info('[RESPONSE_TRUNCATED_FOR_VOICE]', {
        originalWords: words.length,
        truncatedWords: formatted.split(/\s+/).length,
      });
    }

    formatted = formatted.replace(/\s*\n+\s*/g, '. ');
    formatted = formatted.replace(/\s{2,}/g, ' ');
    formatted = formatted.replace(/([.!?])\1+/g, '$1');

    return formatted.trim();
  }

  private async speakProgressively(session: CallSession, text: string): Promise<void> {
    if (!text || !session.ttsClient || !session.ws) return;

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    const voice = session.agent?.voice || 'aura-asteria-en';
    const model = (session.agent as any)?.ttsModel || undefined;

    const INTER_SENTENCE_DELAY_MS = 300;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, INTER_SENTENCE_DELAY_MS));
      }

      if (session.isResponding && session.ws && session.ws.readyState === 1) {
        try {
          await session.ttsClient.speak(session, sentence, session.ws, voice, model);
        } catch (error) {
          logger.error('[PROGRESSIVE_SPEECH_ERROR]', {
            callSid: session.callSid,
            sentence,
            error,
          });
        }
      } else {
        logger.debug('[PROGRESSIVE_SPEECH_CANCELLED]', {
          callSid: session.callSid,
          reason: 'session_interrupted',
        });
        break;
      }
    }
  }

  private logCallConfiguration(session: CallSession): void {
    const sttProvider = String(((session.agent as any)?.sttProvider ?? 'LOCAL')).toUpperCase();
    const sttModel = (session.agent as any)?.sttModel ||
      (sttProvider === 'LOCAL' ? 'faster-whisper' :
       sttProvider === 'SARVAM' ? 'saaras:v3' :
       sttProvider === 'ELEVENLABS' ? 'scribe_v2_realtime' : 'nova-2');

    const ttsProvider = String(((session.agent as any)?.ttsProvider ?? 'LOCAL')).toUpperCase();
    const ttsModel = (session.agent as any)?.ttsModel ||
      (ttsProvider === 'LOCAL' ? 'piper' :
       ttsProvider === 'ELEVENLABS' ? 'eleven_turbo_v2_5' :
       ttsProvider === 'CARTESIA' ? 'sonic-english' :
       ttsProvider === 'SARVAM' ? 'bulbul:v3' : 'aura-asteria-en');
    
    const llmProvider = (session.agent as any)?.llmProvider || 'openrouter';
    const llmModel = (session.agent as any)?.llmModel || 'openai/gpt-4o-mini';
    
    logger.info('[CALL_CONFIGURATION_SUMMARY]', {
      callSid: session.callSid,
      agentId: session.agent?.id,
      agentName: session.agent?.name,
      language: session.agent?.language,
      voice: session.agent?.voice,
      stt: {
        provider: sttProvider.toLowerCase(),
        model: sttModel,
      },
      tts: {
        provider: ttsProvider.toLowerCase(),
        model: ttsModel,
      },
      llm: {
        provider: llmProvider,
        model: llmModel,
        temperature: session.agent?.temperature ?? 0.3,
      },
    });
  }

  private async selectProvidersForSession(session: CallSession, connectionId: string): Promise<void> {
    // (Re)initialize STT based on agent config if needed.
    // The call starts with the default provider (LOCAL) before the agent loads;
    // only restart STT when the agent actually wants a different provider.
    try {
      const desiredSttProvider = String(((session.agent as any)?.sttProvider ?? 'LOCAL')).toUpperCase();
      const currentSttProvider = String(session.sttProviderName ?? '').toUpperCase();

      if (session.sttClient && currentSttProvider && desiredSttProvider !== currentSttProvider) {
        try {
          await session.sttClient.close();
        } catch { }
        session.sttClient = undefined;
        session.sttStream = undefined;
        session.sttProviderName = undefined;
      }

      if (!session.sttClient) {
        await this.initSttStream(session, connectionId);
      }
    } catch (error) {
      logger.warn('Failed to select STT provider; continuing', { callSid: session.callSid, error });
    }

    // Initialize TTS client based on agent config with fallback to Deepgram.
    const ttsProvider = String(((session.agent as any)?.ttsProvider ?? 'LOCAL')).toUpperCase();
    const ttsModel = (session.agent as any)?.ttsModel || undefined;

    try {
      if (ttsProvider === 'LOCAL') {
        // Verify the in-house server is reachable so we can degrade gracefully.
        await checkLocalVoiceServerHealth(VOICE_AI_BASE_URL);
        session.ttsClient = new LocalTTS({ baseUrl: VOICE_AI_BASE_URL, defaultVoice: 'male1' });
        logger.info('[TTS_PROVIDER_SELECTED]', {
          provider: 'local',
          model: 'piper',
          baseUrl: VOICE_AI_BASE_URL,
          voice: session.agent?.voice,
          callSid: session.callSid
        });
        return;
      }

      if (ttsProvider === 'ELEVENLABS') {
        if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
        const model = ttsModel || 'eleven_turbo_v2_5';
        session.ttsClient = new ElevenLabsTTS({ apiKey: ELEVENLABS_API_KEY, model });
        logger.info('[TTS_PROVIDER_SELECTED]', { 
          provider: 'elevenlabs', 
          model,
          voice: session.agent?.voice,
          callSid: session.callSid 
        });
        return;
      }

      if (ttsProvider === 'CARTESIA') {
        if (!CARTESIA_API_KEY) throw new Error('CARTESIA_API_KEY not set');
        const model = ttsModel || 'sonic-english';
        session.ttsClient = new CartesiaTTS({ apiKey: CARTESIA_API_KEY, model });
        logger.info('[TTS_PROVIDER_SELECTED]', { 
          provider: 'cartesia', 
          model,
          voice: session.agent?.voice,
          callSid: session.callSid 
        });
        return;
      }

      if (ttsProvider === 'SARVAM') {
        if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set');
        const model = (ttsModel as any) || 'bulbul:v3';
        session.ttsClient = new SarvamTTS({ apiKey: SARVAM_API_KEY, model });
        logger.info('[TTS_PROVIDER_SELECTED]', { 
          provider: 'sarvam', 
          model,
          voice: session.agent?.voice,
          callSid: session.callSid 
        });
        return;
      }

      if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');
      session.ttsClient = new DeepgramTTS({ apiKey: DEEPGRAM_API_KEY });
      logger.info('[TTS_PROVIDER_SELECTED]', { 
        provider: 'deepgram', 
        model: 'aura-asteria-en',
        voice: session.agent?.voice,
        callSid: session.callSid 
      });
    } catch (error) {
      logger.warn('[TTS_PROVIDER_FALLBACK_TO_DEEPGRAM]', {
        callSid: session.callSid,
        requestedProvider: ttsProvider,
        error,
      });

      if (DEEPGRAM_API_KEY) {
        session.ttsClient = new DeepgramTTS({ apiKey: DEEPGRAM_API_KEY });
        logger.info('[TTS_PROVIDER_SELECTED]', { 
          provider: 'deepgram', 
          model: 'aura-asteria-en',
          voice: session.agent?.voice,
          callSid: session.callSid 
        });
      } else {
        session.ttsClient = undefined;
        logger.warn('No TTS API key available; TTS disabled', { callSid: session.callSid });
      }
    }
  }

  private async cleanupSession(connectionId: string): Promise<void> {
    const session = this.sessions.get(connectionId);

    if (session) {
      logger.debug('Cleaning up session', {
        callSid: session.callSid,
        connectionId
      });

      if (session.partialDebounceTimer) {
        clearTimeout(session.partialDebounceTimer);
        session.partialDebounceTimer = undefined;
      }

      if (session.sttClient) {
        await session.sttClient.close();
        logger.info('STT stream closed', { callSid: session.callSid });
      }

      if (session.ttsClient && session.callSid) {
        session.ttsClient.cleanup(session.callSid);
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

  getActiveSessionsData(): Array<{
    callSid: string;
    agentId: string | null;
    agentName: string | null;
    status: string;
    startTime: string;
    currentTranscript: Array<{ role: string; content: string; timestamp: string }>;
    phone: string | null;
  }> {
    const activeSessions: Array<{
      callSid: string;
      agentId: string | null;
      agentName: string | null;
      status: string;
      startTime: string;
      currentTranscript: Array<{ role: string; content: string; timestamp: string }>;
      phone: string | null;
    }> = [];

    for (const session of this.sessions.values()) {
      if (session.callSid) {
        activeSessions.push({
          callSid: session.callSid,
          agentId: session.agent?.id ?? null,
          agentName: session.agent?.name ?? null,
          status: session.isResponding ? 'responding' : session.isSpeaking ? 'speaking' : 'listening',
          startTime: session.startedAt.toISOString(),
          currentTranscript: session.conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp?.toISOString() ?? new Date().toISOString(),
          })),
          phone: session.fromPhoneNumber ?? session.toPhoneNumber ?? null,
        });
      }
    }

    return activeSessions;
  }

  async hangupCall(callSid: string): Promise<boolean> {
    const session = Array.from(this.sessions.values()).find((s) => s.callSid === callSid);

    if (!session) {
      logger.warn('Session not found for hangup', { callSid });
      return false;
    }

    logger.info('[HANGUP_REQUESTED]', { callSid });

    if (session.ws && session.ws.readyState === 1) {
      session.ws.close();
    }

    const connectionId = Array.from(this.sessions.entries()).find(([_, s]) => s.callSid === callSid)?.[0];
    if (connectionId) {
      await this.cleanupSession(connectionId);
    }

    return true;
  }
}
