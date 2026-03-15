import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';

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

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  handleVoiceWebhook(req: Request, res: Response): void {
    const { CallSid, From, To } = req.body;

    logger.info('Incoming voice call', { 
      callSid: CallSid, 
      from: From, 
      to: To 
    });

    const twiml = this.generateStreamTwiML(To);
    
    res.type('text/xml');
    res.send(twiml);
  }

  private generateStreamTwiML(toPhoneNumber: string): string {
    const encodedPhone = encodeURIComponent(toPhoneNumber);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${this.wsUrl}">
      <Parameter name="toPhoneNumber" value="${encodedPhone}" />
    </Stream>
  </Connect>
</Response>`;
  }
}
