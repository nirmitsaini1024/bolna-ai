import { PrismaClient, Call } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('CallService');

export class CallService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for CallService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('CallService initialized');
  }

  async createCall(params: {
    callSid: string;
    phone: string;
    agentId?: string;
  }): Promise<Call> {
    const { callSid, phone, agentId } = params;

    try {
      const call = await this.prisma.call.create({
        data: {
          callSid,
          phone,
          agentId,
          startedAt: new Date(),
        },
      });

      logger.info('[CALL_CREATED]', {
        callSid,
        callId: call.id,
        agentId: call.agentId,
        phone: call.phone,
      });

      return call;
    } catch (error) {
      logger.error('Failed to create call', { callSid, phone, agentId, error });
      throw error;
    }
  }

  async endCall(callSid: string): Promise<Call | null> {
    try {
      const existing = await this.prisma.call.findUnique({
        where: { callSid },
      });

      if (!existing) {
        logger.warn('Call not found when ending', { callSid });
        return null;
      }

      const endedAt = new Date();
      const durationMs = Math.max(endedAt.getTime() - existing.startedAt.getTime(), 0);
      const updated = await this.prisma.call.update({
        where: { id: existing.id },
        data: { endedAt, durationMs },
      });

      logger.info('[CALL_ENDED]', {
        callSid,
        callId: updated.id,
        durationMs: updated.durationMs,
      });

      return updated;
    } catch (error) {
      logger.error('Failed to end call', { callSid, error });
      throw error;
    }
  }

  async findCallBySid(callSid: string): Promise<Call | null> {
    try {
      const call = await this.prisma.call.findUnique({
        where: { callSid },
      });

      return call;
    } catch (error) {
      logger.error('Failed to find call by SID', { callSid, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('CallService disconnected');
  }
}

