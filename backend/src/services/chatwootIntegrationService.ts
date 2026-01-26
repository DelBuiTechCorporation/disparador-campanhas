import axios from 'axios';
import { tenantSettingsService } from './tenantSettingsService';

export interface ChatwootTagAction {
  action: 'add' | 'remove';
  tags: string[];
}

export class ChatwootIntegrationService {
  async getChatwootConfig(tenantId: string) {
    try {
      const settings = await tenantSettingsService.getTenantSettings(tenantId);

      if (!settings.chatwootUrl || !settings.chatwootAccountId || !settings.chatwootApiToken) {
        throw new Error('Chatwoot não configurado');
      }

      return {
        url: settings.chatwootUrl,
        accountId: settings.chatwootAccountId,
        token: settings.chatwootApiToken
      };
    } catch (error) {
      console.error('Erro ao obter configurações do Chatwoot:', error);
      throw error;
    }
  }

  async findContactByPhone(tenantId: string, phonenumber: string): Promise<number | null> {
    try {
      const config = await this.getChatwootConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/v1/accounts/${config.accountId}/contacts/search`;

      // Normalizar telefone para busca (remover caracteres especiais)
      const normalizedPhone = phonenumber.replace(/[^\d+]/g, '');

      console.log(`🔍 Buscando contato no Chatwoot: ${normalizedPhone}`);

      const response = await axios.get(url, {
        headers: {
          'api_access_token': config.token,
          'Content-Type': 'application/json'
        },
        params: {
          q: normalizedPhone
        },
        timeout: 30000
      });

      if (response.data && response.data.payload && response.data.payload.length > 0) {
        const contact = response.data.payload[0];
        console.log(`✅ Contato encontrado no Chatwoot: ${contact.id} - ${contact.name}`);
        return contact.id;
      }

      console.log(`⚠️ Contato não encontrado no Chatwoot para o telefone: ${phonenumber}`);
      return null;
    } catch (error: any) {
      console.error('❌ Erro ao buscar contato no Chatwoot:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      return null;
    }
  }

  async updateContactTags(tenantId: string, contactId: number, action: 'add' | 'remove', tags: string[]): Promise<boolean> {
    try {
      const config = await this.getChatwootConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/v1/accounts/${config.accountId}/contacts/${contactId}`;

      console.log(`💬 Chatwoot Integration - ${action === 'add' ? 'Adicionando' : 'Removendo'} tags do contato ${contactId}:`, tags);

      // Primeiro, buscar tags atuais do contato
      const getResponse = await axios.get(url, {
        headers: {
          'api_access_token': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const currentTags = getResponse.data.payload?.contact_inboxes?.[0]?.contact?.labels || [];
      let newTags: string[] = currentTags.map((t: any) => t.title || t);

      if (action === 'add') {
        // Adicionar novas tags (evitar duplicatas)
        tags.forEach(tag => {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        });
      } else if (action === 'remove') {
        // Remover tags
        newTags = newTags.filter(tag => !tags.includes(tag));
      }

      // Atualizar contato com novas tags
      const updateResponse = await axios.put(url, {
        labels: newTags
      }, {
        headers: {
          'api_access_token': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (updateResponse.status === 200) {
        console.log(`✅ Tags do contato ${contactId} atualizadas no Chatwoot com sucesso`);
        return true;
      }

      console.warn(`⚠️ Resposta inesperada ao atualizar tags: ${updateResponse.status}`);
      return false;
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar tags do contato ${contactId} no Chatwoot:`, error.message);

      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }

      throw error;
    }
  }

  async executeIntegration(tenantId: string, phonenumber: string, action: 'add' | 'remove', tags: string[]): Promise<boolean> {
    try {
      console.log(`💬 Executando integração Chatwoot - Ação: ${action}, Tags: ${tags.join(', ')}, Telefone: ${phonenumber}`);

      // Buscar contato pelo telefone
      const contactId = await this.findContactByPhone(tenantId, phonenumber);

      if (!contactId) {
        console.warn('Contato não encontrado no Chatwoot, pulando integração');
        return false;
      }

      // Executar ação nas tags
      return await this.updateContactTags(tenantId, contactId, action, tags);
    } catch (error) {
      console.error('❌ Erro ao executar integração Chatwoot:', error);
      return false;
    }
  }
}

export const chatwootIntegrationService = new ChatwootIntegrationService();
