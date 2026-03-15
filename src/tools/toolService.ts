import { PrismaClient, Tool } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';
import { ToolDefinition } from './toolTypes';
import { toolRegistry } from './toolRegistry';

const logger = createLogger('ToolService');

export class ToolService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for ToolService');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('ToolService initialized');
  }

  async loadToolsForAgent(agentId: string): Promise<ToolDefinition[]> {
    const records: Tool[] = await this.prisma.tool.findMany({
      where: { agentId },
      orderBy: { createdAt: 'asc' },
    });

    const definitions: ToolDefinition[] = records.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    // Also ensure built-in demo tools are available even if DB is empty.
    const builtIns = this.getBuiltInTools();
    const all = [...builtIns.filter((b) => !definitions.some((d) => d.name === b.name)), ...definitions];

    toolRegistry.setToolsForAgent(agentId, all);

    return all;
  }

  getBuiltInTools(): ToolDefinition[] {
    return [
      {
        name: 'check_order',
        description: 'Check order status using order ID',
        parameters: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'The order ID to look up',
            },
          },
          required: ['orderId'],
        },
      },
      {
        name: 'create_support_ticket',
        description: 'Create a new support ticket for a customer issue',
        parameters: {
          type: 'object',
          properties: {
            issue: {
              type: 'string',
              description: 'Description of the customer issue',
            },
          },
          required: ['issue'],
        },
      },
      {
        name: 'lookup_customer',
        description: 'Lookup customer details by phone number',
        parameters: {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              description: 'Customer phone number',
            },
          },
          required: ['phone'],
        },
      },
    ];
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('ToolService disconnected');
  }
}

