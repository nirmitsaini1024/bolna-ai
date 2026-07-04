import { KnowledgeDocument, KnowledgeSource } from '@prisma/client';
import { EmbeddingService } from './embeddingService';
import { KnowledgeRepository } from './knowledgeRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger('KnowledgeService');

export class KnowledgeService {
  private embeddingService: EmbeddingService | null = null;
  private repository: KnowledgeRepository;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || '';

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

  async addSource(params: {
    type: string;
    title: string;
    url?: string | null;
  }): Promise<KnowledgeSource> {
    return this.repository.createSource(params);
  }

  async addChunk(params: {
    agentId?: string | null;
    sourceId: string;
    content: string;
  }): Promise<KnowledgeDocument> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not available');
    }

    const trimmed = params.content.trim();
    if (!trimmed) {
      throw new Error('Knowledge chunk content cannot be empty');
    }

    const embedding = await this.embeddingService.generateEmbedding(trimmed);
    return this.repository.storeChunk({
      agentId: params.agentId ?? null,
      sourceId: params.sourceId,
      content: trimmed,
      embedding,
    });
  }

  async listSources(): Promise<Array<{ id: string; title: string; type: string; createdAt: Date; url: string | null }>> {
    return this.repository.listSources();
  }

  async deleteSource(sourceId: string): Promise<void> {
    await this.repository.deleteSource(sourceId);
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

    const documents = await this.repository.searchSimilarDocumentsForAgent(agentId, embedding, limit);

    logger.info('[KB_RETRIEVAL]', {
      agentId,
      query: trimmedQuery,
      documentsReturned: documents.length,
    });

    return documents;
  }
}

