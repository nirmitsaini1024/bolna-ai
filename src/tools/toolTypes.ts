export interface ToolDefinition {
  name: string;
  description: string;
  // JSON Schema-ish parameters definition, forwarded directly to LLM tools
  parameters: any;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
}

