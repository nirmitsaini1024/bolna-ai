import { ToolCall, ToolResult } from './toolTypes';
import { createLogger } from '../utils/logger';

const logger = createLogger('ToolExecutor');

export class ToolExecutor {
  async executeTool(_agentId: string | undefined, call: ToolCall): Promise<ToolResult> {
    logger.info('[TOOL_CALL]', {
      toolName: call.name,
      arguments: call.arguments,
    });

    try {
      let result: unknown;

      switch (call.name) {
        case 'check_order': {
          const orderId = String(call.arguments.orderId ?? '');
          result = this.checkOrder(orderId);
          break;
        }
        case 'create_support_ticket': {
          const issue = String(call.arguments.issue ?? '');
          result = this.createSupportTicket(issue);
          break;
        }
        case 'lookup_customer': {
          const phone = String(call.arguments.phone ?? '');
          result = this.lookupCustomer(phone);
          break;
        }
        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }

      const toolResult: ToolResult = {
        name: call.name,
        result,
      };

      logger.info('[TOOL_RESULT]', {
        toolName: call.name,
        result,
      });

      return toolResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error('Tool execution failed', {
        toolName: call.name,
        error: message,
      });

      return {
        name: call.name,
        result: null,
        error: message,
      };
    }
  }

  private checkOrder(orderId: string): string {
    if (!orderId) {
      return 'No order ID provided.';
    }

    return `Order ${orderId} is currently shipped and will arrive tomorrow.`;
  }

  private createSupportTicket(_issue: string): { ticketId: string; status: string } {
    return {
      ticketId: 'TICKET-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      status: 'open',
    };
  }

  private lookupCustomer(phone: string): { phone: string; name: string; status: string } {
    const normalized = phone.replace(/\D/g, '');

    return {
      phone: normalized || 'unknown',
      name: 'Demo Customer',
      status: 'active',
    };
  }
}

export const toolExecutor = new ToolExecutor();

