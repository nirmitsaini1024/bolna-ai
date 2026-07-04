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
  llmProvider?: string;
  llmModel?: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  voice?: string;
  ttsModel?: string;
  sttModel?: string;
  ttsProvider?: 'LOCAL' | 'DEEPGRAM' | 'SARVAM' | 'ELEVENLABS' | 'CARTESIA' | string;
  sttProvider?: 'LOCAL' | 'DEEPGRAM' | 'SARVAM' | 'ELEVENLABS' | string;
}

export interface Call {
  id: string;
  callSid?: string;
  phone: string;
  agentId?: string | null;
  startedAt?: string;
  endedAt?: string | null;
  durationMs?: number | null;
  createdAt: string;
}

export interface CallMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ActiveCall {
  callSid: string;
  agentId: string | null;
  agentName: string | null;
  status: string;
  startTime: string;
  currentTranscript: Array<{ role: string; content: string; timestamp: string }>;
  phone: string | null;
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

export interface KnowledgeSource {
  id: string;
  title: string;
  type: string;
  url?: string | null;
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

  async getKnowledgeSources(agentId: string): Promise<KnowledgeSource[]> {
    // Global list (agent selection/attachment is separate)
    return request<KnowledgeSource[]>(`/knowledge/source`);
  }

  async deleteKnowledgeSource(sourceId: string): Promise<{ success: true }> {
    return request<{ success: true }>(`/knowledge/source/${sourceId}`, { method: 'DELETE' });
  }

  async uploadKnowledgePdf(agentId: string, file: File): Promise<{ uploadedChunks: number; sourceId: string }> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    // agentId optional; passing it will also store it on chunks for debugging,
    // but attachment is controlled via /agents/:id/knowledge-sources.
    if (agentId) formData.append('agentId', agentId);
    formData.append('file', file);

    const response = await fetch(`${API_URL}/knowledge/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const data = await response.json();
        if (data && typeof data.error === 'string') message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return (await response.json()) as { uploadedChunks: number; sourceId: string };
  }

  async addKnowledgeUrl(agentId: string, url: string): Promise<{ uploadedChunks: number; sourceId: string }> {
    return request<{ uploadedChunks: number; sourceId: string }>('/knowledge/url', {
      method: 'POST',
      body: { agentId, url },
    });
  }

  async getAgentKnowledgeSourceIds(agentId: string): Promise<{ sourceIds: string[] }> {
    return request<{ sourceIds: string[] }>(`/agents/${agentId}/knowledge-sources`);
  }

  async setAgentKnowledgeSourceIds(agentId: string, sourceIds: string[]): Promise<{ success: true; sourceIds: string[] }> {
    return request<{ success: true; sourceIds: string[] }>(`/agents/${agentId}/knowledge-sources`, {
      method: 'PUT',
      body: { sourceIds },
    });
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

  async getActiveCalls(): Promise<ActiveCall[]> {
    return request<ActiveCall[]>('/calls/active');
  }

  async hangupCall(callSid: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/calls/${callSid}/hangup`, {
      method: 'POST',
    });
  }
}

export const bolnaAPI = new BolnaAPI();
