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
  private systemPrompt = `You are a friendly phone assistant speaking in a natural conversation.

CRITICAL VOICE GUIDELINES:
- Keep responses SHORT: 1-2 sentences maximum
- Use conversational, natural tone
- Speak like a helpful human, not a formal assistant
- Use short sentences with natural pauses
- Add commas for breathing room
- Avoid long explanations or lists

GOOD EXAMPLES:
"Sure, we offer cardiology care. Emergency services are available 24/7."
"Yes, we do. Let me help you with that."
"Got it. I can schedule that for you."

BAD EXAMPLES (too long/formal):
"Our hospital provides comprehensive cardiology services including diagnostic testing, interventional procedures, and cardiac rehabilitation programs."

Remember: You're speaking on a phone call. Be concise and natural.`;
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

  /**
   * Streaming chat completion for low-latency voice responses.
   *
   * Notes:
   * - Tools/function calling is NOT supported in streaming mode.
   * - Intended for simple "no tools" assistant replies where we can
   *   start speaking as soon as text chunks arrive.
   */
  async generateChatStream(
    request: {
      messages: Message[];
      temperature?: number;
    },
    onToken: (deltaText: string) => void
  ): Promise<{ fullText: string }> {
    const body: any = {
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? this.temperature,
      stream: true,
    };

    try {
      logger.debug('Sending streaming chat request to OpenRouter', {
        model: this.model,
        messageCount: request.messages.length,
        temperature: body.temperature,
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenRouter streaming API error: ${response.status} - ${errorText}`);
      }

      const reader = (response.body as any).getReader();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += new TextDecoder().decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith('data:')) {
            continue;
          }

          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') {
            continue;
          }

          try {
            const json = JSON.parse(dataStr);
            const choice = json.choices?.[0];
            const deltaText: string | undefined =
              choice?.delta?.content ??
              (typeof choice?.delta === 'string' ? choice.delta : undefined);

            if (deltaText) {
              fullText += deltaText;
              onToken(deltaText);
            }
          } catch (err) {
            logger.warn('Failed to parse OpenRouter streaming chunk', { error: (err as Error).message });
          }
        }
      }

      logger.debug('Completed streaming response from OpenRouter', {
        model: this.model,
        responseLength: fullText.length,
      });

      return { fullText };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed during streaming LLM chat response', {
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
