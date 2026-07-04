import { PrismaClient, KnowledgeDocument, KnowledgeSource } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('KnowledgeRepository');

export class KnowledgeRepository {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for KnowledgeRepository');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('KnowledgeRepository initialized');
  }

  async storeDocument(agentId: string, content: string, embedding: number[]): Promise<KnowledgeDocument> {
    try {
      // Legacy helper kept for backwards compatibility. Prefer storeChunk().
      // We create a source per agent and attach this chunk to it.
      const source = await this.createSource({
        type: 'TEXT',
        title: 'Inline note',
        url: null,
      });

      const document = await this.storeChunk({
        agentId,
        sourceId: source.id,
        content,
        embedding,
      });

      logger.info('[KB_DOCUMENT_ADDED]', {
        agentId,
        documentId: document.id,
        contentLength: content.length,
        embeddingDimensions: embedding.length,
      });

      return document;
    } catch (error) {
      logger.error('Failed to store knowledge document', { error });
      throw error;
    }
  }

  async createSource(params: {
    type: string;
    title: string;
    url?: string | null;
  }): Promise<KnowledgeSource> {
    const source = await this.prisma.knowledgeSource.create({
      data: {
        type: params.type,
        title: params.title,
        url: params.url ?? null,
      },
    });

    logger.info('[KB_SOURCE_CREATED]', {
      sourceId: source.id,
      type: source.type,
      title: source.title,
    });

    return source;
  }

  async storeChunk(params: {
    agentId?: string | null;
    sourceId: string;
    content: string;
    embedding: number[];
  }): Promise<KnowledgeDocument> {
    const vectorLiteral = `[${params.embedding.join(',')}]`;

    const result = await this.pool.query(
      `
      INSERT INTO "KnowledgeDocument" ("id", "agentId", "sourceId", "content", "embedding")
      VALUES (gen_random_uuid(), $1, $2, $3, $4::vector(1536))
      RETURNING "id", "organizationId", "agentId", "sourceId", "content", "embedding", "createdAt"
      `,
      [params.agentId ?? null, params.sourceId, params.content, vectorLiteral]
    );

    return result.rows[0] as KnowledgeDocument;
  }

  async listSources(): Promise<Array<Pick<KnowledgeSource, 'id' | 'title' | 'type' | 'createdAt' | 'url'>>> {
    return this.prisma.knowledgeSource.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true, url: true },
    });
  }

  async deleteSource(sourceId: string): Promise<void> {
    // FK is ON DELETE CASCADE, this removes chunks as well.
    await this.prisma.knowledgeSource.delete({ where: { id: sourceId } });
  }

  async searchSimilarDocumentsForAgent(agentId: string, embedding: number[], limit: number): Promise<KnowledgeDocument[]> {
    try {
      const vectorLiteral = `[${embedding.join(',')}]`;

      const result = await this.pool.query(
        `
        SELECT "id", "organizationId", "agentId", "sourceId", "content", "embedding", "createdAt"
        FROM "KnowledgeDocument"
        WHERE "sourceId" IN (
          SELECT "sourceId" FROM "AgentKnowledgeSource" WHERE "agentId" = $1
        )
        ORDER BY "embedding" <-> $2::vector(1536)
        LIMIT $3
        `,
        [agentId, vectorLiteral, limit]
      );

      const scored = result.rows as KnowledgeDocument[];

      logger.info('[KB_RETRIEVAL]', {
        agentId,
        documentsAvailable: scored.length,
        documentsReturned: scored.length,
      });

      return scored;
    } catch (error) {
      logger.error('Failed to search knowledge documents', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('KnowledgeRepository disconnected');
  }
}

