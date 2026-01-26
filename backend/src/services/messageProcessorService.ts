/**
 * Message Processor Service
 * Processa mensagens recebidas e executa fluxos interativos
 *
 * NOTA: Esta é uma versão simplificada sem BullMQ.
 * Em produção, usar BullMQ para queue/workers com retries e backoff.
 */

import { interactiveCampaignService } from './interactiveCampaignService';
import { flowEngineService } from './flowEngineService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InboundMessage {
  messageId: string;
  connectionId: string;
  from: string;
  to: string;
  content?: string;
  type: string;
  timestamp: Date;
}

export const messageProcessorService = {
  /**
   * Processa uma mensagem inbound
   * Em produção, seria enfileirado no BullMQ
   */
  async processInboundMessage(message: InboundMessage) {
    try {
      console.log(`Processing inbound message from ${message.from} on connection ${message.connectionId}`);

      // Buscar TODAS as campanhas iniciadas
      const allCampaigns = await prisma.interactiveCampaign.findMany({
        where: { status: 'STARTED' },
      });

      if (allCampaigns.length === 0) {
        console.log('No published campaigns found');
        return;
      }

      // Buscar contato para pegar categorias
      const contact = await prisma.contact.findFirst({
        where: {
          telefone: {
            contains: message.from.replace(/[^0-9]/g, ''),
          },
        },
        include: {
          categoria: true,
        },
      });

      const contactCategoryId = contact?.categoriaId;
      console.log(`Contact ${message.from} category: ${contactCategoryId || 'none'}`);

      // Filtrar campanhas que se aplicam a esta mensagem
      const applicableCampaigns = allCampaigns.filter((campaign) => {
        const graph = campaign.graph as any;

        // Buscar nó trigger no graph
        const triggerNode = graph.nodes?.find((n: any) => n.data?.nodeType === 'trigger');

        if (!triggerNode) {
          console.log(`Campaign ${campaign.id} has no trigger node`);
          return false;
        }

        const triggerConfig = triggerNode.data?.config;

        if (!triggerConfig) {
          console.log(`Campaign ${campaign.id} trigger has no config`);
          return false;
        }

        // Verificar se a conexão está configurada no trigger
        const connections = triggerConfig.connections || [];
        if (!connections.includes(message.connectionId)) {
          console.log(`Campaign ${campaign.id} does not include connection ${message.connectionId}`);
          return false;
        }

        // Verificar se a categoria do contato está configurada no trigger
        const categories = triggerConfig.categories || [];
        if (categories.length > 0 && contactCategoryId && !categories.includes(contactCategoryId)) {
          console.log(`Campaign ${campaign.id} does not include contact category ${contactCategoryId}`);
          return false;
        }

        // Se não tem categoria configurada, aceita todos
        if (categories.length > 0 && !contactCategoryId) {
          console.log(`Campaign ${campaign.id} requires categories but contact has none`);
          return false;
        }

        console.log(`Campaign ${campaign.id} (${campaign.name}) is applicable`);
        return true;
      });

      if (applicableCampaigns.length === 0) {
        console.log('No applicable campaigns for this message');
        return;
      }

      const contactTags: string[] = [];

      // Executar cada campanha aplicável
      for (const campaign of applicableCampaigns) {
        const graph = campaign.graph as any;

        console.log(`Executing campaign ${campaign.id} (${campaign.name})`);

        const result = await flowEngineService.executeFlow(graph, {
          from: message.from,
          to: message.to,
          content: message.content,
          type: message.type,
          timestamp: message.timestamp,
          contactTags,
        });

        console.log(`Campaign ${campaign.id} execution result:`, result);

        // Executar ações resultantes
        for (const action of result.actions) {
          await this.executeAction(action, message.connectionId);
        }
      }
    } catch (error) {
      console.error('Error processing inbound message:', error);
      // Em produção: retry ou DLQ
    }
  },

  /**
   * Executa uma ação resultante do fluxo
   */
  async executeAction(action: any, connectionId: string) {
    try {
      switch (action.type) {
        case 'sendMessage':
          await this.sendMessage(connectionId, action.data);
          break;

        case 'addTag':
          await this.addTagToContact(action.data);
          break;

        case 'createChatwootTicket':
          await this.createChatwootTicket(action.data);
          break;

        case 'httpWebhook':
          await this.callHttpWebhook(action.data);
          break;

        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
      // Em produção: retry com backoff exponencial
    }
  },

  /**
   * Envia mensagem via WhatsApp
   * TODO: Integrar com Evolution/WAHA/Quepasa API
   */
  async sendMessage(connectionId: string, data: any) {
    console.log(`Sending message to ${data.to}:`, data.content);

    // TODO: Implementar envio real via API do provedor
    // Por enquanto, apenas log
  },

  /**
   * Adiciona tag ao contato
   */
  async addTagToContact(data: any) {
    console.log(`Adding tag ${data.tag} to contact ${data.contactPhone}`);

    try {
      // Buscar contato por telefone
      const contact = await prisma.contact.findFirst({
        where: { telefone: data.contactPhone },
      });

      if (contact) {
        // Adicionar tag se não existir
        const tags = contact.tags || [];
        if (!tags.includes(data.tag)) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              tags: [...tags, data.tag],
            },
          });
        }
      }
    } catch (error) {
      console.error('Error adding tag to contact:', error);
    }
  },

  /**
   * Cria ticket no Chatwoot
   * TODO: Integrar com Chatwoot API
   */
  async createChatwootTicket(data: any) {
    console.log(`Creating Chatwoot ticket for ${data.contactPhone}`);

    // TODO: Implementar integração real com Chatwoot
    // Por enquanto, apenas log
  },

  /**
   * Chama webhook HTTP externo
   */
  async callHttpWebhook(data: any) {
    console.log(`Calling HTTP webhook: ${data.url}`);

    try {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(data.url, {
        method: data.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      console.log(`Webhook call successful: ${data.url}`);
    } catch (error) {
      console.error('Error calling HTTP webhook:', error);
      throw error;
    }
  },
};
