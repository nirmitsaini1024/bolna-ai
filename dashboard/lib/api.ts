const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface HealthResponse {
  status: string;
  uptime: number;
  activeConnections: number;
  activeSessions: number;
}

export interface Agent {
  id: string;
  name: string;
  status: 'draft' | 'active';
  systemPrompt?: string;
  welcomeMessage?: string;
  llmModel?: string;
  temperature?: number;
  maxTokens?: number;
  voice?: string;
  ttsProvider?: string;
  sttProvider?: 'DEEPGRAM' | 'SARVAM' | string;
}

export interface Call {
  id: string;
  phone: string;
  agentId?: string | null;
  durationMs?: number | null;
  createdAt: string;
}

export interface CallMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ToolConfig {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  content: string;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: any;
  authToken?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authToken } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = authToken ?? (typeof window !== 'undefined' ? localStorage.getItem('jwt') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') {
        message = data.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

export class BolnaAPI {
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  }

  async getRoot(): Promise<any> {
    return request<any>('/');
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async getAgents(): Promise<Agent[]> {
    return request<Agent[]>('/agents');
  }

  async getAgent(id: string): Promise<Agent> {
    return request<Agent>(`/agents/${id}`);
  }

  async createAgent(partial: Partial<Agent>): Promise<Agent> {
    return request<Agent>('/agents', {
      method: 'POST',
      body: partial,
    });
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    return request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await request<void>(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async getCalls(): Promise<Call[]> {
    return request<Call[]>('/calls');
  }

  async getCallMessages(callId: string): Promise<CallMessage[]> {
    return request<CallMessage[]>(`/calls/${callId}/messages`);
  }

  async createOutboundCall(phone: string, agentId: string): Promise<{ id: string; callSid?: string }> {
    return request<{ id: string; callSid?: string }>('/outbound/call', {
      method: 'POST',
      body: { phone, agentId },
    });
  }

  async getKnowledgeDocs(agentId: string): Promise<KnowledgeDocument[]> {
    return request<KnowledgeDocument[]>(`/agents/${agentId}/knowledge`);
  }

  async uploadKnowledgeDoc(agentId: string, content: string): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>('/knowledge', {
      method: 'POST',
      body: { agentId, content },
    });
  }

  async getTools(agentId: string): Promise<ToolConfig[]> {
    return request<ToolConfig[]>(`/agents/${agentId}/tools`);
  }

  async updateTool(agentId: string, toolConfig: ToolConfig[]): Promise<ToolConfig[]> {
    return request<ToolConfig[]>(`/agents/${agentId}/tools`, {
      method: 'PUT',
      body: toolConfig,
    });
  }

  async createTestCall(to: string, agentId: string): Promise<{ id: string; callSid?: string }> {
    return request<{ id: string; callSid?: string }>('/call', {
      method: 'POST',
      body: { to, agentId },
    });
  }
}

export const bolnaAPI = new BolnaAPI();
