const API_BASE_URL = '/api';

export interface Connection {
  id: string;
  provider: 'WAHA';
  instanceName: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  callbackUrl: string;
  webhookSecret: string;
  createdAt: string;
  updatedAt: string;
}

export interface InteractiveCampaign {
  id: string;
  connectionId?: string;
  name: string;
  status: 'DRAFT' | 'SCHEDULED' | 'STARTED' | 'PAUSED' | 'COMPLETED';
  scheduledDate?: string;
  graph: {
    nodes: any[];
    edges: any[];
    meta?: any;
  };
  createdAt: string;
  updatedAt: string;
  connection?: Connection;
}

export interface CreateConnectionDto {
  provider: 'WAHA';
  instanceName: string;
  phoneNumber: string;
}

export interface CreateInteractiveCampaignDto {
  connectionId?: string;
  name: string;
  graph: {
    nodes: any[];
    edges: any[];
    meta?: any;
  };
}

export interface UpdateInteractiveCampaignDto {
  name?: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'STARTED' | 'PAUSED' | 'COMPLETED';
  scheduledDate?: Date;
  graph?: {
    nodes: any[];
    edges: any[];
    meta?: any;
  };
}

class InteractiveCampaignApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    // Handle empty responses (like 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    return response.json();
  }

  // ========== CONNECTIONS ==========

  async getConnections(): Promise<Connection[]> {
    return this.request<Connection[]>('/connections');
  }

  async getConnection(id: string): Promise<Connection> {
    return this.request<Connection>(`/connections/${id}`);
  }

  async createConnection(data: CreateConnectionDto): Promise<Connection> {
    return this.request<Connection>('/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConnection(
    id: string,
    data: { status?: string; phoneNumber?: string }
  ): Promise<Connection> {
    return this.request<Connection>(`/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await this.request<void>(`/connections/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== INTERACTIVE CAMPAIGNS ==========

  async getCampaigns(connectionId?: string): Promise<InteractiveCampaign[]> {
    const queryString = connectionId ? `?connectionId=${connectionId}` : '';
    return this.request<InteractiveCampaign[]>(`/interactive-campaigns${queryString}`);
  }

  async getCampaign(id: string): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}`);
  }

  async createCampaign(data: CreateInteractiveCampaignDto): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>('/interactive-campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(
    id: string,
    data: UpdateInteractiveCampaignDto
  ): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.request<void>(`/interactive-campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async publishCampaign(id: string, scheduledDate?: Date): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ scheduledDate }),
    });
  }

  async simulateCampaign(
    id: string,
    data: { from: string; text: string }
  ): Promise<{
    success: boolean;
    executionTrace: any[];
    message: string;
  }> {
    return this.request(`/interactive-campaigns/${id}/simulate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async pauseCampaign(id: string): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}/pause`, {
      method: 'POST',
    });
  }

  async completeCampaign(id: string): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}/complete`, {
      method: 'POST',
    });
  }

  async duplicateCampaign(id: string): Promise<InteractiveCampaign> {
    return this.request<InteractiveCampaign>(`/interactive-campaigns/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async getCampaignReport(id: string): Promise<any> {
    return this.request(`/interactive-campaigns/${id}/report`);
  }
}

export const interactiveCampaignApi = new InteractiveCampaignApiService();
