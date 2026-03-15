import { PrismaClient, Message } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('MessageService');

export class MessageService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for MessageService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('MessageService initialized');
  }

  async storeMessage(
    callId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    confidence?: number,
  ): Promise<Message> {
    try {
      const message = await this.prisma.message.create({
        data: {
          callId,
          role,
          content,
          confidence,
        },
      });

      logger.info('[MESSAGE_STORED]', {
        callId,
        messageId: message.id,
        role: message.role,
      });

      return message;
    } catch (error) {
      logger.error('Failed to store message', { callId, role, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('MessageService disconnected');
  }
}

