import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { OutboundService } from './outboundService';
import { CreateOutboundCallRequest } from './outboundTypes';

const logger = createLogger('OutboundController');

export class OutboundController {
  private outboundService: OutboundService;

  constructor() {
    this.outboundService = new OutboundService();
  }

  async createOutboundCall(req: Request, res: Response): Promise<void> {
    const { phone, agentId } = req.body as CreateOutboundCallRequest;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      res.status(400).json({ error: 'phone is required' });
      return;
    }

    try {
      const outboundCall = await this.outboundService.createOutboundCall(phone, agentId);

      res.status(201).json({
        id: outboundCall.id,
        phone: outboundCall.phone,
        agentId: outboundCall.agentId,
        status: outboundCall.status,
        callSid: outboundCall.callSid,
        createdAt: outboundCall.createdAt,
      });
    } catch (error) {
      logger.error('Failed to create outbound call', { error });
      res.status(500).json({ error: 'Failed to create outbound call' });
    }
  }
}

