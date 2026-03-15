const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface HealthResponse {
  status: string;
  uptime: number;
  activeConnections: number;
  activeSessions: number;
}

export class BolnaAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch health: ${response.statusText}`);
    }
    return response.json();
  }

  async getRoot(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch root: ${response.statusText}`);
    }
    return response.json();
  }
}

export const bolnaAPI = new BolnaAPI();
