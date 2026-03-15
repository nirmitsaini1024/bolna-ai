import { UsageService } from './usageService';

export class BillingService {
  private usageService: UsageService;

  constructor() {
    this.usageService = new UsageService();
  }

  async getOrganizationUsage(organizationId: string) {
    return this.usageService.getUsageSummary(organizationId);
  }
}

