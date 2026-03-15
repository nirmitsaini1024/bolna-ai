import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { OutboundService } from '../outbound/outboundService';

const logger = createLogger('TwiMLController');

/**
 * TwiMLController generates Twilio Markup Language (TwiML) responses.
 * 
 * TwiML is XML that instructs Twilio how to handle phone calls.
 * The <Connect><Stream> verb tells Twilio to:
 * 
 * 1. Establish a WebSocket connection to our gateway
 * 2. Stream bidirectional audio (inbound + outbound tracks)
 * 3. Send events (start, media, stop) throughout the call
 * 
 * Twilio Media Streams Flow:
 * 
 * Call arrives → POST /voice → Return TwiML → Twilio connects to /stream
 * 
 * This separation of concerns allows:
 * - HTTP endpoint scales independently
 * - WebSocket gateway handles stateful connections
 * - Clean architecture for future middleware (auth, routing, etc.)
 */
export class TwiMLController {
  private wsUrl: string;
  private outboundService: OutboundService;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.outboundService = new OutboundService();
  }

  async handleVoiceWebhook(req: Request, res: Response): Promise<void> {
    const { CallSid, From, To, Direction } = req.body as {
      CallSid?: string;
      From?: string;
      To?: string;
      Direction?: string;
    };

    logger.info('Incoming voice call', { 
      callSid: CallSid, 
      from: From, 
      to: To,
      direction: Direction,
    });

    let agentId: string | undefined;

    if (CallSid) {
      try {
        const outboundCall = await this.outboundService.findByCallSid(CallSid);
        if (outboundCall && outboundCall.agentId) {
          agentId = outboundCall.agentId;
          logger.info('[OUTBOUND_CALL_CONNECTED]', {
            callSid: CallSid,
            outboundCallId: outboundCall.id,
            agentId: outboundCall.agentId,
          });
        }
      } catch (error) {
        logger.error('Failed to resolve outbound call for webhook', {
          callSid: CallSid,
          error,
        });
      }
    }

    const twiml = this.generateStreamTwiML(To, agentId);
    
    res.type('text/xml');
    res.send(twiml);
  }

  private generateStreamTwiML(toPhoneNumber: string, agentId?: string): string {
    const encodedPhone = encodeURIComponent(toPhoneNumber);
    const agentParam = agentId
      ? `      <Parameter name="agentId" value="${encodeURIComponent(agentId)}" />\n`
      : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${this.wsUrl}">
      <Parameter name="toPhoneNumber" value="${encodedPhone}" />
${agentParam}    </Stream>
  </Connect>
</Response>`;
  }
}
