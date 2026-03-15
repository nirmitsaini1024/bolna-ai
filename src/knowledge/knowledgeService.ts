import { KnowledgeDocument } from '@prisma/client';
import { EmbeddingService } from './embeddingService';
import { KnowledgeRepository } from './knowledgeRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger('KnowledgeService');

export class KnowledgeService {
  private embeddingService: EmbeddingService | null = null;
  private repository: KnowledgeRepository;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      logger.warn('OPENROUTER_API_KEY not set, KnowledgeService embeddings disabled');
    } else {
      this.embeddingService = new EmbeddingService({
        apiKey,
        model: process.env.OPENROUTER_EMBEDDING_MODEL,
      });
    }

    this.repository = new KnowledgeRepository();
  }

  async addDocument(agentId: string, content: string): Promise<KnowledgeDocument> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not available');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Knowledge document content cannot be empty');
    }

    const embedding = await this.embeddingService.generateEmbedding(trimmed);

    const document = await this.repository.storeDocument(agentId, trimmed, embedding);

    return document;
  }

  async searchRelevantDocs(agentId: string, query: string, limit = 3): Promise<KnowledgeDocument[]> {
    if (!this.embeddingService) {
      logger.warn('Embedding service not available, skipping knowledge retrieval');
      return [];
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const embedding = await this.embeddingService.generateEmbedding(trimmedQuery);

    const documents = await this.repository.searchSimilarDocuments(agentId, embedding, limit);

    logger.info('[KB_RETRIEVAL]', {
      agentId,
      query: trimmedQuery,
      documentsReturned: documents.length,
    });

    return documents;
  }
}

