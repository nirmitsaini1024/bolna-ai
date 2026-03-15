import { Agent } from '@prisma/client';
import { AgentRepository } from './agentRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentService');

interface CacheEntry {
  agent: Agent;
  timestamp: number;
}

export class AgentService {
  private repository: AgentRepository;
  private cache: Map<string, CacheEntry>;
  private cacheTTL: number;

  constructor(cacheTTLSeconds: number = 300) {
    this.repository = new AgentRepository();
    this.cache = new Map();
    this.cacheTTL = cacheTTLSeconds * 1000;

    logger.info('AgentService initialized', { 
      cacheTTL: `${cacheTTLSeconds}s` 
    });
  }

  async getAgentByPhoneNumber(phoneNumber: string): Promise<Agent | null> {
    const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
    
    const cached = this.getFromCache(normalizedNumber);
    if (cached) {
      logger.debug('Agent loaded from cache', { 
        phoneNumber: normalizedNumber,
        agentId: cached.id,
        agentName: cached.name,
      });
      return cached;
    }

    const agent = await this.repository.findByPhoneNumber(normalizedNumber);
    
    if (agent) {
      this.setCache(normalizedNumber, agent);
      
      logger.info('[AGENT_LOADED]', {
        phoneNumber: normalizedNumber,
        agentId: agent.id,
        agentName: agent.name,
        voice: agent.voice,
        temperature: agent.temperature,
      });
    } else {
      logger.warn('No agent found for phone number', { 
        phoneNumber: normalizedNumber 
      });
    }

    return agent;
  }

  async getAgentById(agentId: string): Promise<Agent | null> {
    const cached = this.getFromCacheById(agentId);
    if (cached) {
      logger.debug('Agent loaded from cache by ID', { 
        agentId,
        agentName: cached.name,
      });
      return cached;
    }

    const agent = await this.repository.findById(agentId);
    
    if (agent) {
      logger.info('Agent loaded from database', {
        agentId: agent.id,
        agentName: agent.name,
      });
    }

    return agent;
  }

  invalidateCache(phoneNumber?: string): void {
    if (phoneNumber) {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      this.cache.delete(normalized);
      logger.info('Cache invalidated for phone number', { 
        phoneNumber: normalized 
      });
    } else {
      this.cache.clear();
      logger.info('Cache cleared completely');
    }
  }

  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL / 1000,
    };
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, '');
  }

  private getFromCache(phoneNumber: string): Agent | null {
    const entry = this.cache.get(phoneNumber);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(phoneNumber);
      logger.debug('Cache entry expired', { phoneNumber });
      return null;
    }

    return entry.agent;
  }

  private getFromCacheById(agentId: string): Agent | null {
    for (const entry of this.cache.values()) {
      if (entry.agent.id === agentId) {
        const now = Date.now();
        if (now - entry.timestamp <= this.cacheTTL) {
          return entry.agent;
        }
      }
    }
    return null;
  }

  private setCache(phoneNumber: string, agent: Agent): void {
    this.cache.set(phoneNumber, {
      agent,
      timestamp: Date.now(),
    });

    logger.debug('Agent cached', { 
      phoneNumber,
      agentId: agent.id,
      cacheSize: this.cache.size,
    });
  }

  async shutdown(): Promise<void> {
    this.cache.clear();
    await this.repository.disconnect();
    logger.info('AgentService shutdown');
  }
}
