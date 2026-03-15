import { ToolDefinition } from './toolTypes';
import { createLogger } from '../utils/logger';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  private toolsByAgent: Map<string, ToolDefinition[]> = new Map();

  registerTool(agentId: string, tool: ToolDefinition): void {
    const current = this.toolsByAgent.get(agentId) ?? [];
    this.toolsByAgent.set(agentId, [...current, tool]);

    logger.info('Tool registered', {
      agentId,
      toolName: tool.name,
    });
  }

  setToolsForAgent(agentId: string, tools: ToolDefinition[]): void {
    this.toolsByAgent.set(agentId, tools);
    logger.info('Tools set for agent', {
      agentId,
      toolCount: tools.length,
    });
  }

  getToolsForAgent(agentId: string): ToolDefinition[] {
    return this.toolsByAgent.get(agentId) ?? [];
  }

  validateToolParameters(tool: ToolDefinition, args: Record<string, unknown>): void {
    // Basic validation: if parameters has "required", check presence
    const schema = tool.parameters;
    const required: string[] | undefined = schema?.required;

    if (required && Array.isArray(required)) {
      for (const key of required) {
        if (!(key in args)) {
          throw new Error(`Missing required parameter "${key}" for tool "${tool.name}"`);
        }
      }
    }
  }
}

export const toolRegistry = new ToolRegistry();

