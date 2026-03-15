import { PrismaClient, Customer, CustomerNote } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('CustomerRepository');

export class CustomerRepository {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for CustomerRepository');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('CustomerRepository initialized');
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    try {
      return await this.prisma.customer.findUnique({
        where: { phone },
      });
    } catch (error) {
      logger.error('Failed to find customer by phone', { phone, error });
      throw error;
    }
  }

  async createCustomer(phone: string, name?: string | null): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          phone,
          name: name ?? null,
        },
      });

      logger.info('[CUSTOMER_CREATED]', {
        customerId: customer.id,
        phone: customer.phone,
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create customer', { phone, error });
      throw error;
    }
  }

  async getCustomerNotes(customerId: string, limit: number): Promise<CustomerNote[]> {
    try {
      const notes = await this.prisma.customerNote.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notes;
    } catch (error) {
      logger.error('Failed to load customer notes', { customerId, error });
      throw error;
    }
  }

  async attachCallToCustomer(callId: string, customerId: string): Promise<void> {
    try {
      await this.prisma.call.update({
        where: { id: callId },
        data: { customerId },
      });
    } catch (error) {
      logger.error('Failed to attach call to customer', { callId, customerId, error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
    logger.info('CustomerRepository disconnected');
  }
}

