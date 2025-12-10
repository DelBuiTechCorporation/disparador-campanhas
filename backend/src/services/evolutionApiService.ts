import { settingsService } from './settingsService';

interface EvolutionCreateInstanceRequest {
  instanceName: string;
  qrcode: boolean;
  integration: string;
  webhook?: {
    url: string;
    byEvents: boolean;
    base64: boolean;
    headers: {
      'Content-Type': string;
    };
    events: string[];
  };
}

interface EvolutionCreateInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  qrcode?: {
    pairingCode?: string;
    code?: string;
    base64?: string;
  };
}

interface EvolutionInstanceInfo {
  instanceName: string;
  status: string;
  profilePictureUrl?: string;
  profileName?: string;
  profileStatus?: string;
  owner?: string;
}

export class EvolutionApiService {
  private static instance: EvolutionApiService;

  public static getInstance(): EvolutionApiService {
    if (!EvolutionApiService.instance) {
      EvolutionApiService.instance = new EvolutionApiService();
    }
    return EvolutionApiService.instance;
  }

  private async getConfig() {
    return await settingsService.getEvolutionConfig();
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const config = await this.getConfig();

    if (!config.host || !config.apiKey) {
      throw new Error('Configurações Evolution API não encontradas. Configure nas configurações do sistema.');
    }

    const url = `${config.host}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': config.apiKey,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  async createInstance(instanceName: string, webhookUrl?: string): Promise<EvolutionCreateInstanceResponse> {
    const requestData: EvolutionCreateInstanceRequest = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    };

    // Se webhookUrl fornecida, adicionar configuração de webhook
    if (webhookUrl) {
      requestData.webhook = {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        headers: {
          'Content-Type': 'application/json'
        },
        events: ['MESSAGES_UPSERT']
      };
    }

    const response = await this.makeRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    return response.json() as Promise<EvolutionCreateInstanceResponse>;
  }

  async getInstanceInfo(instanceName: string): Promise<EvolutionInstanceInfo> {
    const response = await this.makeRequest(`/instance/fetchInstances?instanceName=${instanceName}`);
    const data = await response.json() as EvolutionInstanceInfo[];

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    throw new Error(`Instância ${instanceName} não encontrada`);
  }

  async getQRCode(instanceName: string): Promise<string> {
    try {
      const response = await this.makeRequest(`/instance/connect/${instanceName}`);
      const data = await response.json() as { base64?: string; code?: string; pairingCode?: string };

      // Evolution API pode retornar base64, code ou pairingCode
      if (data.base64) {
        // Verificar se o base64 já tem o prefixo data:image
        if (data.base64.startsWith('data:image/')) {
          return data.base64;
        }
        return `data:image/png;base64,${data.base64}`;
      }

      if (data.code) {
        // Se retornar apenas o código, converter para base64
        return data.code;
      }

      throw new Error('QR Code não disponível');
    } catch (error: any) {
      console.error(`❌ Erro ao obter QR Code da Evolution API para ${instanceName}:`, error.message);
      throw new Error(`QR Code não disponível: ${error.message}`);
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.makeRequest(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    });
  }

  async restartInstance(instanceName: string): Promise<void> {
    await this.makeRequest(`/instance/restart/${instanceName}`, {
      method: 'PUT'
    });
  }

  async getInstanceStatus(instanceName: string): Promise<string> {
    try {
      const info = await this.getInstanceInfo(instanceName);
      console.log(`🔍 Evolution getInstanceInfo para ${instanceName}:`, JSON.stringify(info, null, 2));

      // Mapear status Evolution para status do sistema
      const statusMap: { [key: string]: string } = {
        'open': 'WORKING',
        'connecting': 'SCAN_QR_CODE',
        'close': 'STOPPED',
        'closed': 'STOPPED',
        'qr': 'SCAN_QR_CODE',
        'qrReadSuccess': 'WORKING',
        'qrReadFail': 'FAILED'
      };

      // Evolution API pode usar connectionStatus, state ou status
      const rawData = info as any;
      const evolutionStatus = rawData.connectionStatus || rawData.state || rawData.status || 'close';

      console.log(`🔍 Status bruto Evolution para ${instanceName}: "${evolutionStatus}"`);
      const mappedStatus = statusMap[evolutionStatus.toLowerCase()] || 'STOPPED';
      console.log(`📊 Status mapeado para ${instanceName}: "${mappedStatus}"`);

      return mappedStatus;
    } catch (error) {
      console.warn(`⚠️ Erro ao obter status Evolution para ${instanceName}:`, error);
      return 'STOPPED';
    }
  }

  async listInstances(): Promise<EvolutionInstanceInfo[]> {
    const response = await this.makeRequest('/instance/fetchInstances');
    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }
}

export const evolutionApiService = EvolutionApiService.getInstance();