import { PrismaClient, ToolEvent } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('ToolEventService');

export class ToolEventService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for ToolEventService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('ToolEventService initialized');
  }

  async storeToolEvent(
    callId: string,
    toolName: string,
    args: unknown,
    result: unknown,
  ): Promise<ToolEvent> {
    try {
      const event = await this.prisma.toolEvent.create({
        data: {
          callId,
          toolName,
          arguments: args as any,
          result: result as any,
        },
      });

      logger.info('[TOOL_EVENT_STORED]', {
        callId,
        toolEventId: event.id,
        toolName: event.toolName,
      });

      return event;
    } catch (error) {
      logger.error('Failed to store tool event', { callId, toolName, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('ToolEventService disconnected');
  }
}

