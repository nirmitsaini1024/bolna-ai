import { createLogger } from '../utils/logger';

const logger = createLogger('EmbeddingService');

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
}

interface OpenRouterEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export class EmbeddingService {
  private apiKey: string;
  private model: string;
  private apiUrl = 'https://openrouter.ai/api/v1/embeddings';

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'openai/text-embedding-3-small';

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required for embeddings');
    }

    logger.info('EmbeddingService initialized', {
      model: this.model,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Cannot generate embedding for empty text');
    }

    const body = {
      model: this.model,
      input: trimmed,
    };

    try {
      logger.debug('Requesting embedding from OpenRouter', {
        model: this.model,
        textLength: trimmed.length,
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter embeddings error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterEmbeddingResponse;

      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenRouter');
      }

      const embedding = data.data[0].embedding;

      logger.debug('Received embedding from OpenRouter', {
        dimensions: embedding.length,
      });

      return embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate embedding', { error: message });
      throw error;
    }
  }
}

