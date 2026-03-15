import { Customer } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { CustomerRepository } from './customerRepository';

const logger = createLogger('CustomerService');

export class CustomerService {
  private repository: CustomerRepository;

  constructor() {
    this.repository = new CustomerRepository();
  }

  async findCustomerByPhone(phone: string): Promise<Customer | null> {
    if (!phone) {
      return null;
    }

    const normalized = phone.trim();
    if (!normalized) {
      return null;
    }

    const customer = await this.repository.findByPhone(normalized);

    if (customer) {
      logger.info('[CUSTOMER_LOADED]', {
        customerId: customer.id,
        phone: customer.phone,
      });
    }

    return customer;
  }

  async createCustomer(phone: string, name?: string | null): Promise<Customer> {
    const normalized = phone.trim();
    const customer = await this.repository.createCustomer(normalized, name);
    return customer;
  }

  async getOrCreateCustomer(phone: string): Promise<Customer | null> {
    if (!phone) {
      return null;
    }

    const existing = await this.findCustomerByPhone(phone);
    if (existing) {
      return existing;
    }

    return this.createCustomer(phone);
  }

  async getCustomerHistorySummary(customerId: string): Promise<string | undefined> {
    const notes = await this.repository.getCustomerNotes(customerId, 10);

    if (!notes.length) {
      return undefined;
    }

    const lines = notes
      .map((note) => {
        const timestamp = note.createdAt.toISOString();
        return `- [${timestamp}] ${note.content}`;
      })
      .join('\n');

    return `Customer history:\n${lines}`;
  }

  async attachCallToCustomer(callId: string, customerId: string): Promise<void> {
    await this.repository.attachCallToCustomer(callId, customerId);
  }
}

