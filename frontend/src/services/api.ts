import { Contact, ContactInput, ContactsResponse, Category, CategoryInput, CategoriesResponse, ImportResult } from '../types';

const API_BASE_URL = '/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('auth_token');
    const selectedTenantId = localStorage.getItem('selected_tenant_id');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    // Adicionar X-Tenant-Id header para SuperAdmin quando tenant está selecionado
    if (selectedTenantId) {
      (headers as Record<string, string>)['X-Tenant-Id'] = selectedTenantId;
    }

    // Usar AbortController com timeout de 30 segundos para evitar 524
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));

        // Detectar erro 524 (gateway timeout) e tentar recuperar
        if (response.status === 524) {
          throw new Error('Requisição demorou muito. Tente novamente em alguns momentos.');
        }

        // Detectar erro de quota e adicionar flag para tratamento especial
        if (error.upgradeRequired || (error.message && error.message.includes('Limite'))) {
          const quotaError = new Error(error.message || error.error || 'Limite atingido');
          (quotaError as any).isQuotaError = true;
          (quotaError as any).upgradeRequired = true;
          throw quotaError;
        }

        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      // Handle empty responses (like 204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T;
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Se foi abortado por timeout
      if (error.name === 'AbortError') {
        throw new Error('Requisição expirou. O servidor está demorando muito. Tente novamente.');
      }

      throw error;
    }
  }

  async getContacts(params?: {
    search?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ContactsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.set('search', params.search);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());

    const queryString = searchParams.toString();
    const endpoint = `/contatos${queryString ? `?${queryString}` : ''}`;

    return this.request<ContactsResponse>(endpoint);
  }

  async getContact(id: string): Promise<Contact> {
    return this.request<Contact>(`/contatos/${id}`);
  }

  async createContact(data: ContactInput): Promise<Contact> {
    return this.request<Contact>('/contatos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: ContactInput): Promise<Contact> {
    return this.request<Contact>(`/contatos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id: string): Promise<void> {
    await this.request<void>(`/contatos/${id}`, {
      method: 'DELETE',
    });
  }

  // Category methods
  async getCategories(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CategoriesResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());

    const queryString = searchParams.toString();
    const endpoint = `/categorias${queryString ? `?${queryString}` : ''}`;

    return this.request<CategoriesResponse>(endpoint);
  }

  async getAllCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categorias/all');
  }

  async getCategory(id: string): Promise<Category> {
    return this.request<Category>(`/categorias/${id}`);
  }

  async createCategory(data: CategoryInput): Promise<Category> {
    return this.request<Category>('/categorias', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: CategoryInput): Promise<Category> {
    return this.request<Category>(`/categorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request<void>(`/categorias/${id}`, {
      method: 'DELETE',
    });
  }

  // CSV Import methods
  async importCSV(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('csv', file);

    const token = localStorage.getItem('auth_token');
    const selectedTenantId = localStorage.getItem('selected_tenant_id');
    const headers: HeadersInit = {};

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    if (selectedTenantId) {
      (headers as Record<string, string>)['X-Tenant-Id'] = selectedTenantId;
    }

    const response = await fetch(`${API_BASE_URL}/csv/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async downloadCSVTemplate(): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const selectedTenantId = localStorage.getItem('selected_tenant_id');
    const headers: HeadersInit = {};

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    if (selectedTenantId) {
      (headers as Record<string, string>)['X-Tenant-Id'] = selectedTenantId;
    }

    const response = await fetch(`${API_BASE_URL}/csv/template`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.blob();
  }

  // Bulk operations
  async post(endpoint: string, data: any): Promise<any> {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get(endpoint: string, options?: { params?: Record<string, any> }): Promise<any> {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request(url, {
      method: 'GET',
    });
  }

  async patch(endpoint: string, data: any): Promise<any> {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint: string, data: any): Promise<any> {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<any> {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Chatwoot integration - SSE stream para tags
  streamChatwootTags(onUpdate: (tags: Array<{ name: string; count: number }>) => void, onError: (error: string) => void): EventSource {
    const token = localStorage.getItem('auth_token');
    const selectedTenantId = localStorage.getItem('superadmin_selected_tenant');
    
    // Construir URL com parâmetros necessários
    const params = new URLSearchParams();
    if (token) {
      params.append('token', token);
    }
    if (selectedTenantId) {
      params.append('tenantId', selectedTenantId);
    }
    
    const url = `${API_BASE_URL}/chatwoot/tags/stream?${params.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('tags_update', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data.tags || []);
      } catch (error) {
        console.error('Erro ao parsear tags_update:', error);
      }
    });

    eventSource.addEventListener('tags_complete', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data.tags || []);
        eventSource.close();
      } catch (error) {
        console.error('Erro ao parsear tags_complete:', error);
        eventSource.close();
      }
    });

    eventSource.addEventListener('tags_error', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onError(data.error || 'Erro desconhecido');
        eventSource.close();
      } catch (error) {
        console.error('Erro ao parsear tags_error:', error);
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      onError('Conexão perdida com o servidor');
      eventSource.close();
    };

    return eventSource;
  }


}

export const apiService = new ApiService();
export const api = apiService;