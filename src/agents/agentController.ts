import { Request, Response } from 'express';
import { AgentRepository } from './agentRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentController');

export class AgentController {
  private repository: AgentRepository;

  constructor() {
    this.repository = new AgentRepository();
  }

  async listAgents(_req: Request, res: Response): Promise<void> {
    try {
      const agents = await this.repository.listAgents();
      res.json(agents);
    } catch (error) {
      logger.error('Failed to list agents', { error });
      res.status(500).json({ error: 'Failed to list agents' });
    }
  }

  async createAgent(req: Request, res: Response): Promise<void> {
    const {
      name,
      systemPrompt,
      welcomeMessage,
      llmModel,
      maxTokens,
      temperature,
      sttProvider,
      sttModel,
      language,
      ttsProvider,
      voice,
      speechRate,
      stability,
      similarityBoost,
      styleExaggeration,
      interruptWords,
      responseLatency,
      endpointingMs,
      silenceTimeout,
      maxCallDuration,
      finalCallMessage,
      telephonyProvider,
      noiseCancellation,
      voicemailDetection,
      autoReschedule,
    } = req.body as {
      name?: string;
      systemPrompt?: string;
      welcomeMessage?: string;
      llmModel?: string;
      maxTokens?: number;
      temperature?: number;
      sttProvider?: string;
      sttModel?: string;
      language?: string;
      ttsProvider?: string;
      voice?: string;
      speechRate?: number;
      stability?: number;
      similarityBoost?: number;
      styleExaggeration?: number;
      interruptWords?: number;
      responseLatency?: number;
      endpointingMs?: number;
      silenceTimeout?: number;
      maxCallDuration?: number;
      finalCallMessage?: string;
      telephonyProvider?: string;
      noiseCancellation?: boolean;
      voicemailDetection?: boolean;
      autoReschedule?: boolean;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const prompt = typeof systemPrompt === 'string' && systemPrompt.trim()
      ? systemPrompt
      : 'You are a helpful voice agent.';

    const voiceId = typeof voice === 'string' && voice.trim() ? voice : 'default';

    try {
      const agent = await this.repository.createAgent({
        name: name.trim(),
        systemPrompt: prompt,
        welcomeMessage: welcomeMessage ?? null,
        llmModel: llmModel ?? null,
        temperature,
        maxTokens: maxTokens ?? null,
        sttProvider: sttProvider as any,
        sttModel: sttModel ?? null,
        language: language ?? null,
        ttsProvider: ttsProvider ?? null,
        voice: voiceId,
        speechRate: speechRate ?? null,
        stability: stability ?? null,
        similarityBoost: similarityBoost ?? null,
        styleExaggeration: styleExaggeration ?? null,
        interruptWords: interruptWords ?? null,
        responseLatency: responseLatency ?? null,
        endpointingMs: endpointingMs ?? null,
        silenceTimeout: silenceTimeout ?? null,
        maxCallDuration: maxCallDuration ?? null,
        finalCallMessage: finalCallMessage ?? null,
        telephonyProvider: telephonyProvider ?? null,
        noiseCancellation: noiseCancellation ?? undefined,
        voicemailDetection: voicemailDetection ?? undefined,
        autoReschedule: autoReschedule ?? undefined,
      });
      res.status(201).json(agent);
    } catch (error) {
      logger.error('Failed to create agent', { error });
      res.status(500).json({ error: 'Failed to create agent' });
    }
  }

  async updateAgent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const {
      name,
      systemPrompt,
      welcomeMessage,
      llmModel,
      temperature,
      maxTokens,
      sttProvider,
      sttModel,
      language,
      ttsProvider,
      voice,
      speechRate,
      stability,
      similarityBoost,
      styleExaggeration,
      interruptWords,
      responseLatency,
      endpointingMs,
      silenceTimeout,
      maxCallDuration,
      finalCallMessage,
      telephonyProvider,
      noiseCancellation,
      voicemailDetection,
      autoReschedule,
    } = req.body as {
      name?: string;
      systemPrompt?: string;
      welcomeMessage?: string;
      llmModel?: string;
      temperature?: number;
      maxTokens?: number;
      sttProvider?: string;
      sttModel?: string;
      language?: string;
      ttsProvider?: string;
      voice?: string;
      speechRate?: number;
      stability?: number;
      similarityBoost?: number;
      styleExaggeration?: number;
      interruptWords?: number;
      responseLatency?: number;
      endpointingMs?: number;
      silenceTimeout?: number;
      maxCallDuration?: number;
      finalCallMessage?: string;
      telephonyProvider?: string;
      noiseCancellation?: boolean;
      voicemailDetection?: boolean;
      autoReschedule?: boolean;
    };

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    try {
      const agent = await this.repository.updateAgent(id, {
        name,
        systemPrompt,
        welcomeMessage,
        llmModel,
        temperature,
        maxTokens,
        sttProvider: sttProvider as any,
        sttModel,
        language,
        ttsProvider,
        voice,
        speechRate,
        stability,
        similarityBoost,
        styleExaggeration,
        interruptWords,
        responseLatency,
        endpointingMs,
        silenceTimeout,
        maxCallDuration,
        finalCallMessage,
        telephonyProvider,
        noiseCancellation,
        voicemailDetection,
        autoReschedule,
      });
      res.json(agent);
    } catch (error) {
      logger.error('Failed to update agent', { id, error });
      res.status(500).json({ error: 'Failed to update agent' });
    }
  }

  async deleteAgent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    try {
      await this.repository.deleteAgent(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete agent', { id, error });
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  }
}

