export enum LLMProvider {
  OPENROUTER = 'OpenRouter',
}

export interface ModelOption {
  id: string;
  label: string;
  tag: string;
}

export const LLM_MODELS: ModelOption[] = [
  // OpenAI Models (via OpenRouter)
  { id: 'openai/gpt-4.1', label: 'gpt-4.1', tag: 'OpenAI' },
  { id: 'openai/gpt-4.1-mini', label: 'gpt-4.1-mini', tag: 'OpenAI' },
  { id: 'openai/gpt-4.1-nano', label: 'gpt-4.1-nano', tag: 'OpenAI' },
  { id: 'openai/gpt-4o', label: 'gpt-4o', tag: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', label: 'gpt-4o-mini', tag: 'OpenAI' },

  // Anthropic Models (via OpenRouter)
  { id: 'anthropic/claude-sonnet-4', label: 'claude-sonnet-4', tag: 'Anthropic' },

  // OpenRouter Native Models
  { id: 'openrouter/auto', label: 'openrouter/auto', tag: 'OpenRouter' },
  { id: 'openrouter/cypher-alpha', label: 'openrouter/cypher-alpha', tag: 'OpenRouter' },
  { id: 'openrouter/mixtral', label: 'openrouter/mixtral', tag: 'OpenRouter' },
  { id: 'openrouter/llama-3', label: 'openrouter/llama-3', tag: 'OpenRouter' },
];

export const DEFAULT_PROVIDER = LLMProvider.OPENROUTER;

export function getAllModels(): ModelOption[] {
  return LLM_MODELS;
}

export function getDefaultModel(): string {
  return LLM_MODELS.length > 0 ? LLM_MODELS[0].id : '';
}
