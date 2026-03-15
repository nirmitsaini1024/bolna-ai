import { PrismaClient, UsageRecord } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('UsageService');

export class UsageService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for UsageService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('UsageService initialized');
  }

  async recordUsage(organizationId: string, type: string, quantity: number): Promise<UsageRecord> {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;

    const record = await this.prisma.usageRecord.create({
      data: {
        organizationId,
        type,
        quantity: safeQuantity,
      },
    });

    logger.info('[USAGE_RECORDED]', {
      organizationId,
      type,
      quantity: record.quantity,
    });

    return record;
  }

  async getUsageSummary(organizationId: string): Promise<{
    call_minutes: number;
    stt_seconds: number;
    tts_seconds: number;
    llm_tokens: number;
  }> {
    const records = await this.prisma.usageRecord.groupBy({
      by: ['type'],
      where: { organizationId },
      _sum: { quantity: true },
    });

    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.type, r._sum.quantity || 0);
    }

    return {
      call_minutes: map.get('call_minutes') || 0,
      stt_seconds: map.get('stt_seconds') || 0,
      tts_seconds: map.get('tts_seconds') || 0,
      llm_tokens: map.get('llm_tokens') || 0,
    };
  }
}

