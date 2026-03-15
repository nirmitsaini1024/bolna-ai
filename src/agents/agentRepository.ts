import { PrismaClient, Agent, PhoneNumber } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentRepository');

export type AgentWithRelations = Agent & {
  phoneNumbers?: PhoneNumber[];
};

export class AgentRepository {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL!;
    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);
    
    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' 
        ? ['error', 'warn'] 
        : ['error'],
    });

    logger.info('AgentRepository initialized');
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Agent | null> {
    try {
      const phoneNumberRecord = await this.prisma.phoneNumber.findUnique({
        where: { phoneNumber },
        include: { agent: true },
      });

      if (!phoneNumberRecord) {
        logger.debug('Phone number not found', { phoneNumber });
        return null;
      }

      logger.debug('Agent found for phone number', {
        phoneNumber,
        agentId: phoneNumberRecord.agent.id,
        agentName: phoneNumberRecord.agent.name,
      });

      return phoneNumberRecord.agent;
    } catch (error) {
      logger.error('Failed to find agent by phone number', { 
        phoneNumber, 
        error 
      });
      throw error;
    }
  }

  async findById(agentId: string): Promise<Agent | null> {
    try {
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        logger.debug('Agent not found', { agentId });
        return null;
      }

      return agent;
    } catch (error) {
      logger.error('Failed to find agent by ID', { agentId, error });
      throw error;
    }
  }

  async createAgent(data: {
    name: string;
    systemPrompt: string;
    voice: string;
    temperature?: number;
  }): Promise<Agent> {
    try {
      const agent = await this.prisma.agent.create({
        data,
      });

      logger.info('Agent created', {
        agentId: agent.id,
        name: agent.name,
      });

      return agent;
    } catch (error) {
      logger.error('Failed to create agent', { data, error });
      throw error;
    }
  }

  async assignPhoneNumber(phoneNumber: string, agentId: string): Promise<PhoneNumber> {
    try {
      const phoneNumberRecord = await this.prisma.phoneNumber.create({
        data: {
          phoneNumber,
          agentId,
        },
      });

      logger.info('Phone number assigned to agent', {
        phoneNumber,
        agentId,
      });

      return phoneNumberRecord;
    } catch (error) {
      logger.error('Failed to assign phone number', { 
        phoneNumber, 
        agentId, 
        error 
      });
      throw error;
    }
  }

  async listAgents(): Promise<Agent[]> {
    try {
      const agents = await this.prisma.agent.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return agents;
    } catch (error) {
      logger.error('Failed to list agents', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('AgentRepository disconnected');
  }
}
