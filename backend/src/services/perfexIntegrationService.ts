import axios from 'axios';
import { tenantSettingsService } from './tenantSettingsService';

export interface PerfexUpdateData {
  status?: string;
  source?: string;
  assigned?: string;
  lost?: string;
  junk?: string;
  [key: string]: any;
}

export class PerfexIntegrationService {
  async getPerfexConfig(tenantId: string) {
    try {
      const settings = await tenantSettingsService.getTenantSettings(tenantId);

      if (!settings.perfexUrl || !settings.perfexToken) {
        throw new Error('Perfex CRM não configurado');
      }

      return {
        url: settings.perfexUrl,
        token: settings.perfexToken
      };
    } catch (error) {
      console.error('Erro ao obter configurações do Perfex:', error);
      throw error;
    }
  }

  async updateLead(tenantId: string, leadId: string, updateData: Partial<PerfexUpdateData>): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex Integration - Atualizando lead ${leadId}:`, updateData);

      const response = await axios.put(url, updateData, {
        headers: {
          'authtoken': config.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`📋 Perfex Response Status: ${response.status}`);
      console.log(`📋 Perfex Response Data:`, JSON.stringify(response.data));

      // Verificar se a resposta indica sucesso
      if (response.data && response.data.status === false) {
        console.error(`❌ Perfex API retornou erro: ${response.data.message}`);
        return false;
      }

      if (response.status === 200 || response.status === 204) {
        console.log(`✅ Lead ${leadId} atualizado no Perfex com sucesso`);
        return true;
      }

      console.warn(`⚠️ Resposta inesperada ao atualizar lead: ${response.status}`);
      return false;
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar lead ${leadId} no Perfex:`, error.message);

      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }

      throw error;
    }
  }

  async findLeadByPhone(tenantId: string, phonenumber: string): Promise<string | null> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads`;

      const response = await axios.get(url, {
        headers: {
          'authtoken': config.token,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (Array.isArray(response.data)) {
        // Normalizar número para comparação (remover caracteres especiais)
        const normalizedPhone = phonenumber.replace(/[^\d]/g, '');

        const lead = response.data.find((l: any) => {
          const leadPhone = (l.phonenumber || '').replace(/[^\d]/g, '');
          return leadPhone.includes(normalizedPhone) || normalizedPhone.includes(leadPhone);
        });

        if (lead) {
          console.log(`✅ Lead encontrado no Perfex: ${lead.id} - ${lead.name}`);
          return lead.id;
        }
      }

      console.log(`⚠️ Lead não encontrado no Perfex para o telefone: ${phonenumber}`);
      return null;
    } catch (error: any) {
      console.error('❌ Erro ao buscar lead no Perfex:', error.message);
      return null;
    }
  }

  async executeIntegration(tenantId: string, phonenumber: string, action: string, value: any, contactId?: string): Promise<boolean> {
    try {
      console.log(`🔧 Executando integração Perfex - Ação: ${action}, Valor: ${value}, Telefone: ${phonenumber}, ContactId: ${contactId}`);

      let leadId: string | null = null;

      // Tentar buscar o perfexLeadId do contato primeiro
      if (contactId) {
        try {
          const { PrismaClient } = await import('@prisma/client');
          const prisma = new PrismaClient();
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { perfexLeadId: true }
          });
          await prisma.$disconnect();

          if (contact?.perfexLeadId) {
            leadId = contact.perfexLeadId;
            console.log(`✅ Usando perfexLeadId do contato: ${leadId}`);
          }
        } catch (error) {
          console.error('Erro ao buscar perfexLeadId do contato:', error);
        }
      }

      // Se não encontrou no contato, buscar pelo telefone
      if (!leadId) {
        console.log('🔍 Buscando lead pelo telefone no Perfex...');
        leadId = await this.findLeadByPhone(tenantId, phonenumber);
      }

      if (!leadId) {
        console.warn('Lead não encontrado no Perfex, pulando integração');
        return false;
      }

      // Mapear ação para campo do Perfex
      const updateData: Partial<PerfexUpdateData> = {};

      switch (action) {
        case 'update_status':
          updateData.status = value;
          break;
        case 'update_source':
          updateData.source = value;
          break;
        case 'assign_to':
          updateData.assigned = value;
          break;
        case 'mark_lost':
          updateData.lost = value ? '1' : '0';
          break;
        case 'mark_junk':
          updateData.junk = value ? '1' : '0';
          break;
        default:
          console.warn(`Ação desconhecida: ${action}`);
          return false;
      }

      // Executar atualização
      return await this.updateLead(tenantId, leadId, updateData);
    } catch (error) {
      console.error('❌ Erro ao executar integração Perfex:', error);
      return false;
    }
  }
}

export const perfexIntegrationService = new PerfexIntegrationService();
