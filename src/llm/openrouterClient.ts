import { createLogger } from '../utils/logger';

const logger = createLogger('OpenRouterClient');

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
}

export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterChoiceMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenRouterToolCall[];
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: OpenRouterChoiceMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenRouterClient handles LLM reasoning for the Voice AI platform.
 * 
 * Phase 3 Architecture:
 * - Receives conversation history (user + assistant messages)
 * - Sends to OpenRouter API for completion
 * - Returns AI-generated text response
 * 
 * Pipeline Integration:
 * Transcript (Final) → LLM Reasoning → AI Response Text
 * 
 * Future Enhancements:
 * - Streaming responses for lower latency
 * - Function calling for tool integration
 * - Context window management for long conversations
 */
export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private systemPrompt = 'You are a helpful AI phone assistant.';
  private temperature = 0.3;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'openai/gpt-4o-mini';

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    logger.info('OpenRouterClient initialized', { model: this.model });
  }

  async generateChat(request: {
    messages: Message[];
    temperature?: number;
    tools?: any[];
  }): Promise<OpenRouterResponse> {
    const body: any = {
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? this.temperature,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }

    try {
      logger.debug('Sending chat request to OpenRouter', {
        model: this.model,
        messageCount: request.messages.length,
        temperature: body.temperature,
        hasTools: Boolean(request.tools && request.tools.length),
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      logger.debug('OpenRouter chat response status', {
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from OpenRouter');
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to generate LLM chat response', {
        error: errorMessage,
        stack: errorStack,
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async generateResponse(
    conversationHistory: Message[], 
    systemPrompt?: string,
    temperature?: number,
    knowledgeContext?: string
  ): Promise<string> {
    const knowledgeMessages: Message[] = knowledgeContext
      ? [
          {
            role: 'system',
            content: `Knowledge Context:\n${knowledgeContext}`,
          },
        ]
      : [];

    const messages: Message[] = [
      { role: 'system', content: systemPrompt || this.systemPrompt },
      ...knowledgeMessages,
      ...conversationHistory,
    ];

    const data = await this.generateChat({
      messages,
      temperature: temperature ?? this.temperature,
    });

    const assistantMessage = data.choices[0].message.content ?? '';

    logger.debug('Received response from OpenRouter', {
      model: data.model,
      tokensUsed: data.usage?.total_tokens,
      responseLength: assistantMessage.length,
    });

    return assistantMessage;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    logger.info('System prompt updated', { 
      promptLength: prompt.length 
    });
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  setTemperature(temperature: number): void {
    this.temperature = temperature;
    logger.info('Temperature updated', { temperature });
  }

  getTemperature(): number {
    return this.temperature;
  }
}
