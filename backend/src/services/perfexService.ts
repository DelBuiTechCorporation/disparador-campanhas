import axios from 'axios';
import { tenantSettingsService } from './tenantSettingsService';

interface PerfexLead {
  id: string;
  hash: string;
  name: string;
  title: string;
  company: string;
  description: string;
  country: string;
  zip: string;
  city: string;
  state: string;
  address: string;
  assigned: string;
  dateadded: string;
  from_form_id: string;
  status: string;
  source: string;
  lastcontact: string;
  dateassigned: string;
  last_status_change: string;
  addedfrom: string;
  email: string;
  website: string;
  leadorder: string;
  phonenumber: string;
  date_converted: string;
  lost: string;
  junk: string;
  last_lead_status: string;
  is_imported_from_email_integration: string;
  email_integration_uid: string;
  is_public: string;
  default_language: string;
  // Campos adicionais retornados pela API
  status_name?: string;
  source_name?: string;
  client_id?: string;
  lead_value?: string;
}

export class PerfexService {
  async getPerfexConfig(tenantId: string) {
    try {
      const settings = await tenantSettingsService.getTenantSettings(tenantId);

      if (!settings.perfexUrl || !settings.perfexToken) {
        throw new Error('Perfex CRM não configurado. Configure na página de Integrações.');
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

  async getLeads(tenantId: string): Promise<PerfexLead[]> {
    try {
      const config = await this.getPerfexConfig(tenantId);

      // Remover barra final da URL se existir
      const baseUrl = config.url.replace(/\/$/, '');

      // Endpoint da API do Perfex CRM para leads
      const url = `${baseUrl}/api/leads`;

      console.log('🔧 Perfex CRM - Buscando leads de:', url);

      const response = await axios.get(url, {
        headers: {
          'authtoken': config.token,
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 segundos
      });

      if (!response.data) {
        console.log('⚠️ Perfex CRM - Nenhum dado retornado');
        return [];
      }

      // A API do Perfex retorna um array de leads diretamente
      const leads = Array.isArray(response.data) ? response.data : [];

      console.log(`✅ Perfex CRM - ${leads.length} leads encontrados`);

      return leads;
    } catch (error: any) {
      console.error('❌ Erro ao buscar leads do Perfex CRM:', error.message);

      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);

        if (error.response.status === 401) {
          throw new Error('Token de autenticação inválido. Verifique o token nas configurações.');
        } else if (error.response.status === 404) {
          throw new Error('URL do Perfex CRM inválida ou API não encontrada.');
        }
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Não foi possível conectar ao Perfex CRM. Verifique a URL.');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Timeout ao conectar com Perfex CRM.');
      }

      throw new Error(error.message || 'Erro ao buscar leads do Perfex CRM');
    }
  }

  async importLeads(
    tenantId: string,
    leadIds: string[],
    categoryId: string,
    prisma: any
  ): Promise<{ imported: number; updated: number; errors: number }> {
    try {
      console.log('🔧 importLeads - Iniciando importação:', { tenantId, leadIds, categoryId });

      const leads = await this.getLeads(tenantId);
      console.log('🔧 importLeads - Total de leads retornados pela API:', leads.length);
      console.log('🔧 importLeads - IDs dos leads retornados:', leads.map(l => l.id));

      const leadsToImport = leads.filter(lead => leadIds.includes(lead.id));
      console.log('🔧 importLeads - Leads filtrados para importar:', leadsToImport.length);
      console.log('🔧 importLeads - IDs dos leads filtrados:', leadsToImport.map(l => l.id));

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (const lead of leadsToImport) {
        console.log('🔧 importLeads - Processando lead:', lead.id, lead.name);
        try {
          // Validar se tem pelo menos nome ou email
          if (!lead.name && !lead.email) {
            console.warn(`⚠️ Lead ${lead.id} sem nome e email, pulando...`);
            errors++;
            continue;
          }

          // Normalizar telefone (remover caracteres especiais)
          let phonenumber = lead.phonenumber || '';
          phonenumber = phonenumber.replace(/[^\d+]/g, '');

          // Se não começar com +, adicionar código do país baseado no country
          if (phonenumber && !phonenumber.startsWith('+')) {
            phonenumber = `+${phonenumber}`;
          }

          // Preparar tags com informações do lead
          const tags: string[] = [];
          if (lead.status_name) tags.push(`status:${lead.status_name}`);
          else if (lead.status) tags.push(`status:${lead.status}`);

          if (lead.source_name) tags.push(`source:${lead.source_name}`);
          else if (lead.source) tags.push(`source:${lead.source}`);

          if (lead.company) tags.push(`company:${lead.company}`);
          if (lead.lead_value && lead.lead_value !== '0.00') tags.push(`value:${lead.lead_value}`);
          tags.push('imported:perfex');

          // Preparar observações com dados adicionais
          const observations = [
            lead.description,
            lead.title ? `Cargo: ${lead.title}` : '',
            lead.address ? `Endereço: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}` : '',
            lead.website ? `Website: ${lead.website}` : '',
            lead.dateadded ? `Data de adição: ${lead.dateadded}` : ''
          ].filter(Boolean).join('\n');

          // Verificar se já existe pelo email ou telefone
          console.log('🔧 Verificando se contato existe:', {
            leadName: lead.name,
            email: lead.email,
            telefone: phonenumber
          });

          // Construir condições apenas se os valores existirem
          const conditions = [];
          if (lead.email && lead.email.trim()) {
            conditions.push({ email: lead.email.trim() });
          }
          if (phonenumber && phonenumber.trim()) {
            conditions.push({ telefone: phonenumber.trim() });
          }

          let existingContact = null;
          if (conditions.length > 0) {
            existingContact = await prisma.contact.findFirst({
              where: {
                tenantId,
                OR: conditions
              }
            });
          }

          console.log('🔧 Contato existente?', existingContact ? `Sim - ID: ${existingContact.id}` : 'Não');

          if (existingContact) {
            // Atualizar contato existente
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                nome: lead.name || existingContact.nome,
                telefone: phonenumber || existingContact.telefone,
                email: lead.email || existingContact.email,
                tags: Array.from(new Set([...existingContact.tags, ...tags])),
                observacoes: observations || existingContact.observacoes,
                categoriaId: categoryId,
                perfexLeadId: lead.id
              }
            });
            updated++;
            console.log(`✅ Contato atualizado: ${lead.name || lead.email}`);
          } else {
            // Criar novo contato
            await prisma.contact.create({
              data: {
                nome: lead.name || lead.email || 'Lead Perfex',
                telefone: phonenumber || '',
                email: lead.email || '',
                tags,
                observacoes: observations,
                categoriaId: categoryId,
                tenantId,
                perfexLeadId: lead.id
              }
            });
            imported++;
            console.log(`✅ Contato importado: ${lead.name || lead.email}`);
          }
        } catch (error) {
          console.error(`❌ Erro ao importar lead ${lead.id}:`, error);
          errors++;
        }
      }

      console.log('🔧 importLeads - Resultado final:', { imported, updated, errors });

      return { imported, updated, errors };
    } catch (error) {
      console.error('❌ Erro ao importar leads do Perfex:', error);
      throw error;
    }
  }

  async getLeadStatuses(tenantId: string): Promise<Array<{ id: string; name: string; color?: string }>> {
    try {
      console.log('🔧 Perfex CRM - Extraindo status dos leads existentes');

      // Buscar todos os leads para extrair status únicos
      const leads = await this.getLeads(tenantId);

      const statusMap = new Map<string, string>();

      leads.forEach(lead => {
        if (lead.status && lead.status_name) {
          statusMap.set(lead.status, lead.status_name);
        }
      });

      const statuses = Array.from(statusMap.entries()).map(([id, name]) => ({
        id,
        name
      }));

      console.log(`✅ Perfex CRM - ${statuses.length} status únicos encontrados`);

      return statuses;
    } catch (error: any) {
      console.error('❌ Erro ao buscar status do Perfex CRM:', error.message);
      // Retornar array vazio ao invés de lançar erro
      return [];
    }
  }

  async getLeadSources(tenantId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      console.log('🔧 Perfex CRM - Extraindo fontes dos leads existentes');

      // Buscar todos os leads para extrair fontes únicas
      const leads = await this.getLeads(tenantId);

      const sourceMap = new Map<string, string>();

      leads.forEach(lead => {
        if (lead.source && lead.source_name) {
          sourceMap.set(lead.source, lead.source_name);
        }
      });

      const sources = Array.from(sourceMap.entries()).map(([id, name]) => ({
        id,
        name
      }));

      console.log(`✅ Perfex CRM - ${sources.length} fontes únicas encontradas`);

      return sources;
    } catch (error: any) {
      console.error('❌ Erro ao buscar fontes do Perfex CRM:', error.message);
      // Retornar array vazio ao invés de lançar erro
      return [];
    }
  }

  async getStaffMembers(tenantId: string): Promise<Array<{ staffid: string; firstname: string; lastname: string; email: string }>> {
    try {
      console.log('🔧 Perfex CRM - Extraindo membros responsáveis dos leads existentes');

      // Buscar todos os leads para extrair membros únicos que foram atribuídos
      const leads = await this.getLeads(tenantId);

      const staffMap = new Map<string, { firstname: string; lastname: string; email: string }>();

      leads.forEach(lead => {
        if (lead.assigned && lead.assigned !== '0') {
          // Como não temos nome do staff, vamos criar um placeholder
          if (!staffMap.has(lead.assigned)) {
            staffMap.set(lead.assigned, {
              firstname: 'Usuário',
              lastname: lead.assigned,
              email: ''
            });
          }
        }
      });

      const staff = Array.from(staffMap.entries()).map(([staffid, data]) => ({
        staffid,
        ...data
      }));

      console.log(`✅ Perfex CRM - ${staff.length} membros únicos encontrados`);

      return staff;
    } catch (error: any) {
      console.error('❌ Erro ao buscar membros da equipe do Perfex CRM:', error.message);
      // Retornar array vazio ao invés de lançar erro
      return [];
    }
  }

  async updateLeadStatus(tenantId: string, leadId: string, statusId: string): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex CRM - Atualizando status do lead ${leadId} para ${statusId}`);

      const response = await axios.put(url, {
        status: statusId
      }, {
        headers: {
          'authtoken': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ Perfex CRM - Status do lead ${leadId} atualizado com sucesso`);
      return response.data?.success !== false;
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar status do lead ${leadId}:`, error.message);
      throw error;
    }
  }

  async updateLeadSource(tenantId: string, leadId: string, sourceId: string): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex CRM - Atualizando fonte do lead ${leadId} para ${sourceId}`);

      const response = await axios.put(url, {
        source: sourceId
      }, {
        headers: {
          'authtoken': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ Perfex CRM - Fonte do lead ${leadId} atualizada com sucesso`);
      return response.data?.success !== false;
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar fonte do lead ${leadId}:`, error.message);
      throw error;
    }
  }

  async assignLead(tenantId: string, leadId: string, staffId: string): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex CRM - Atribuindo lead ${leadId} ao usuário ${staffId}`);

      const response = await axios.put(url, {
        assigned: staffId
      }, {
        headers: {
          'authtoken': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ Perfex CRM - Lead ${leadId} atribuído com sucesso`);
      return response.data?.success !== false;
    } catch (error: any) {
      console.error(`❌ Erro ao atribuir lead ${leadId}:`, error.message);
      throw error;
    }
  }

  async markLeadAsLost(tenantId: string, leadId: string): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex CRM - Marcando lead ${leadId} como perdido`);

      const response = await axios.put(url, {
        lost: 1
      }, {
        headers: {
          'authtoken': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ Perfex CRM - Lead ${leadId} marcado como perdido`);
      return response.data?.success !== false;
    } catch (error: any) {
      console.error(`❌ Erro ao marcar lead ${leadId} como perdido:`, error.message);
      throw error;
    }
  }

  async markLeadAsJunk(tenantId: string, leadId: string): Promise<boolean> {
    try {
      const config = await this.getPerfexConfig(tenantId);
      const baseUrl = config.url.replace(/\/$/, '');
      const url = `${baseUrl}/api/leads/${leadId}`;

      console.log(`🔧 Perfex CRM - Marcando lead ${leadId} como lixo`);

      const response = await axios.put(url, {
        junk: 1
      }, {
        headers: {
          'authtoken': config.token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ Perfex CRM - Lead ${leadId} marcado como lixo`);
      return response.data?.success !== false;
    } catch (error: any) {
      console.error(`❌ Erro ao marcar lead ${leadId} como lixo:`, error.message);
      throw error;
    }
  }
}

export const perfexService = new PerfexService();
