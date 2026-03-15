import { PrismaClient, Prisma, Call } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('AnalyticsService');

export interface ToolUsage {
  toolName: string;
  count: number;
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for AnalyticsService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('AnalyticsService initialized');
  }

  async getCallCount(): Promise<number> {
    try {
      const count = await this.prisma.call.count();
      logger.info('Call count computed', { count });
      return count;
    } catch (error) {
      logger.error('Failed to compute call count', { error });
      throw error;
    }
  }

  async getAverageCallDuration(): Promise<number> {
    try {
      const calls = await this.prisma.call.findMany({
        where: {
          endedAt: {
            not: null,
          },
        },
        select: {
          startedAt: true,
          endedAt: true,
        },
      });

      if (calls.length === 0) {
        return 0;
      }

      const totalDurationMs = calls.reduce((sum, call) => {
        if (!call.endedAt) {
          return sum;
        }
        const duration = call.endedAt.getTime() - call.startedAt.getTime();
        return sum + Math.max(duration, 0);
      }, 0);

      const averageMs = totalDurationMs / calls.length;
      logger.info('Average call duration computed', {
        callCount: calls.length,
        averageMs,
      });

      return averageMs;
    } catch (error) {
      logger.error('Failed to compute average call duration', { error });
      throw error;
    }
  }

  async getMostUsedTools(limit: number = 10): Promise<ToolUsage[]> {
    try {
      const grouped = await this.prisma.toolEvent.groupBy({
        by: ['toolName'],
        _count: {
          toolName: true,
        },
        orderBy: {
          _count: {
            toolName: 'desc',
          },
        },
        take: limit,
      } as Prisma.ToolEventGroupByArgs);

      const result: ToolUsage[] = grouped.map((g) => ({
        toolName: g.toolName,
        count: (g as any)._count.toolName as number,
      }));

      logger.info('Most used tools computed', {
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to compute most used tools', { error });
      throw error;
    }
  }

  async getCallsByAgent(agentId: string): Promise<Call[]> {
    try {
      const calls = await this.prisma.call.findMany({
        where: { agentId },
        orderBy: { startedAt: 'desc' },
      });

      logger.info('Calls fetched for agent', {
        agentId,
        count: calls.length,
      });

      return calls;
    } catch (error) {
      logger.error('Failed to get calls by agent', { agentId, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('AnalyticsService disconnected');
  }
}

