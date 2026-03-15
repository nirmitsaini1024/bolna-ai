import twilio, { Twilio } from 'twilio';
import { PrismaClient, OutboundCall } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('OutboundService');

export class OutboundService {
  private prisma: PrismaClient;
  private pool: Pool;
  private twilioClient: Twilio;
  private fromNumber: string;
  private voiceUrl: string;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for OutboundService');
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_NUMBER;
    const publicUrl = process.env.PUBLIC_URL;

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for outbound calls');
    }

    if (!fromNumber) {
      throw new Error('TWILIO_NUMBER is required for outbound calls');
    }

    if (!publicUrl) {
      throw new Error('PUBLIC_URL is required for outbound calls');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    this.twilioClient = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
    this.voiceUrl = `${publicUrl}/voice`;

    logger.info('OutboundService initialized', {
      fromNumber: this.fromNumber,
      voiceUrl: this.voiceUrl,
    });
  }

  async createOutboundCall(phone: string, agentId?: string): Promise<OutboundCall> {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      throw new Error('phone is required for outbound call');
    }

    const outboundCall = await this.prisma.outboundCall.create({
      data: {
        phone: normalizedPhone,
        agentId: agentId ?? null,
        status: 'initiated',
      },
    });

    logger.info('[OUTBOUND_CALL_CREATED]', {
      outboundCallId: outboundCall.id,
      phone: outboundCall.phone,
      agentId: outboundCall.agentId,
    });

    try {
      const call = await this.twilioClient.calls.create({
        to: normalizedPhone,
        from: this.fromNumber,
        url: this.voiceUrl,
        method: 'POST',
      });

      await this.prisma.outboundCall.update({
        where: { id: outboundCall.id },
        data: {
          callSid: call.sid,
          status: call.status ?? 'queued',
        },
      });

      logger.info('[OUTBOUND_CALL_CONNECTED]', {
        outboundCallId: outboundCall.id,
        callSid: call.sid,
        status: call.status,
      });

      return {
        ...outboundCall,
        callSid: call.sid,
        status: call.status ?? outboundCall.status,
      };
    } catch (error) {
      logger.error('Failed to initiate outbound call with Twilio', {
        outboundCallId: outboundCall.id,
        phone: outboundCall.phone,
        error,
      });

      await this.prisma.outboundCall.update({
        where: { id: outboundCall.id },
        data: {
          status: 'failed',
        },
      });

      throw error;
    }
  }

  async findByCallSid(callSid: string): Promise<OutboundCall | null> {
    try {
      return await this.prisma.outboundCall.findFirst({
        where: { callSid },
      });
    } catch (error) {
      logger.error('Failed to lookup outbound call by callSid', { callSid, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('OutboundService disconnected');
  }
}

