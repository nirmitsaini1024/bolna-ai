import { PrismaClient, KnowledgeDocument } from '@prisma/client';
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
      const document = await this.prisma.knowledgeDocument.create({
        data: {
          agentId,
          content,
          embedding,
        },
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

  async searchSimilarDocuments(agentId: string, embedding: number[], limit: number): Promise<KnowledgeDocument[]> {
    try {
      const documents = await this.prisma.knowledgeDocument.findMany({
        where: { agentId },
      });

      if (documents.length === 0) {
        return [];
      }

      const scored = documents
        .map((doc) => ({
          doc,
          score: this.cosineSimilarity(embedding, doc.embedding),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.doc);

      logger.info('[KB_RETRIEVAL]', {
        agentId,
        documentsAvailable: documents.length,
        documentsReturned: scored.length,
      });

      return scored;
    } catch (error) {
      logger.error('Failed to search knowledge documents', { error });
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i += 1) {
      const va = a[i];
      const vb = b[i];
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('KnowledgeRepository disconnected');
  }
}

