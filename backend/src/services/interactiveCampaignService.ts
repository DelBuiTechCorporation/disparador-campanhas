import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateInteractiveCampaignDto {
  connectionId?: string;
  name: string;
  graph: {
    nodes: any[];
    edges: any[];
    meta?: any;
  };
  tenantId?: string;
}

export interface UpdateInteractiveCampaignDto {
  name?: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'STARTED' | 'PAUSED' | 'COMPLETED';
  scheduledDate?: Date;
  connectionId?: string;
  graph?: {
    nodes: any[];
    edges: any[];
    meta?: any;
  };
}

export const interactiveCampaignService = {
  /**
   * Cria uma nova campanha interativa
   */
  async createCampaign(data: CreateInteractiveCampaignDto) {
    // Extrair connectionId do trigger se não foi fornecido
    let connectionId = data.connectionId;

    if (!connectionId && data.graph) {
      const triggerNode = data.graph.nodes?.find((n: any) => n.data?.nodeType === 'trigger');

      if (triggerNode && triggerNode.data?.config?.connections) {
        const connections = triggerNode.data.config.connections;
        if (connections.length > 0) {
          connectionId = connections[0];
          console.log(`✅ Extracted connectionId from trigger on create: ${connectionId}`);
        }
      }
    }

    // Validar se connectionId existe na tabela Connection
    if (connectionId) {
      const connectionExists = await prisma.connection.findUnique({
        where: { id: connectionId },
      });

      if (!connectionExists) {
        console.warn(`⚠️ ConnectionId ${connectionId} not found in Connection table, setting to null`);
        connectionId = undefined;
      }
    }

    return prisma.interactiveCampaign.create({
      data: {
        ...(connectionId && { connectionId }),
        name: data.name,
        status: 'DRAFT',
        graph: data.graph,
        tenantId: data.tenantId,
      },
      include: {
        connection: true,
      },
    });
  },

  /**
   * Lista campanhas (com filtro opcional por tenant e connection)
   */
  async listCampaigns(tenantId?: string, connectionId?: string) {
    return prisma.interactiveCampaign.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(connectionId && { connectionId }),
      },
      include: {
        connection: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Busca uma campanha por ID (com validação de tenant)
   */
  async getCampaign(id: string, tenantId?: string) {
    return prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
      include: {
        connection: true,
      },
    });
  },

  /**
   * Atualiza uma campanha (com validação de tenant)
   */
  async updateCampaign(id: string, data: UpdateInteractiveCampaignDto, tenantId?: string) {
    // Primeiro verifica se a campanha existe e pertence ao tenant
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para editá-la');
    }

    // Se está atualizando o graph, extrair connectionId do trigger
    if (data.graph) {
      const graph = data.graph as any;
      const triggerNode = graph.nodes?.find((n: any) => n.data?.nodeType === 'trigger');

      if (triggerNode && triggerNode.data?.config?.connections) {
        const connections = triggerNode.data.config.connections;
        if (connections.length > 0) {
          // Pegar primeira conexão configurada
          data.connectionId = connections[0];
          console.log(`✅ Extracted connectionId from trigger: ${data.connectionId}`);
        }
      }
    }

    // Validar se connectionId existe na tabela Connection
    if (data.connectionId) {
      const connectionExists = await prisma.connection.findUnique({
        where: { id: data.connectionId },
      });

      if (!connectionExists) {
        console.warn(`⚠️ ConnectionId ${data.connectionId} not found in Connection table, setting to null`);
        data.connectionId = undefined;
      }
    }

    return prisma.interactiveCampaign.update({
      where: { id },
      data,
      include: {
        connection: true,
      },
    });
  },

  /**
   * Deleta uma campanha (com validação de tenant)
   */
  async deleteCampaign(id: string, tenantId?: string) {
    // Primeiro verifica se a campanha existe e pertence ao tenant
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para deletá-la');
    }

    return prisma.interactiveCampaign.delete({
      where: { id },
    });
  },

  /**
   * Publica uma campanha (muda status para STARTED ou SCHEDULED) (com validação de tenant)
   */
  async publishCampaign(id: string, scheduledDate?: Date, tenantId?: string, status: 'STARTED' | 'SCHEDULED' = 'STARTED') {
    // Primeiro verifica se a campanha existe e pertence ao tenant
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para publicá-la');
    }

    return prisma.interactiveCampaign.update({
      where: { id },
      data: {
        status,
        scheduledDate: scheduledDate || null,
      },
      include: {
        connection: true,
      },
    });
  },

  /**
   * Busca campanhas ativas (STARTED ou SCHEDULED) de uma conexão
   */
  async getPublishedCampaignsByConnection(connectionId: string) {
    return prisma.interactiveCampaign.findMany({
      where: {
        connectionId,
        status: { in: ['STARTED', 'SCHEDULED'] },
      },
      include: {
        connection: true,
      },
    });
  },

  /**
   * Pausa uma campanha (com validação de tenant)
   */
  async pauseCampaign(id: string, tenantId?: string) {
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para pausá-la');
    }

    return prisma.interactiveCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
      include: { connection: true },
    });
  },

  /**
   * Finaliza uma campanha (com validação de tenant)
   */
  async completeCampaign(id: string, tenantId?: string) {
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para finalizá-la');
    }

    return prisma.interactiveCampaign.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { connection: true },
    });
  },

  /**
   * Duplica uma campanha existente
   */
  async duplicateCampaign(id: string, tenantId?: string) {
    const existing = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
    });

    if (!existing) {
      throw new Error('Campanha não encontrada ou você não tem permissão para duplicá-la');
    }

    // Criar nova campanha com os mesmos dados
    const duplicated = await prisma.interactiveCampaign.create({
      data: {
        name: `${existing.name} (cópia)`,
        graph: existing.graph as any,
        status: 'DRAFT',
        connectionId: existing.connectionId,
        tenantId: existing.tenantId,
      },
      include: { connection: true },
    });

    return duplicated;
  },

  /**
   * Obtém relatório detalhado de uma campanha interativa
   */
  async getCampaignReport(id: string, tenantId?: string) {
    console.log(`🔍 Buscando relatório para campanha interativa: ${id}`);

    // Buscar campanha com sessions (contatos que interagiram)
    const campaign = await prisma.interactiveCampaign.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
      include: {
        connection: {
          select: {
            id: true,
            instanceName: true,
            provider: true,
            status: true,
          },
        },
        contactSessions: {
          include: {
            contact: {
              select: {
                id: true,
                nome: true,
                telefone: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      console.log(`❌ Campanha ${id} não encontrada`);
      return null;
    }

    console.log(`✅ Campanha encontrada: ${campaign.name}`);
    console.log(`📊 Total de sessões/contatos: ${campaign.contactSessions?.length || 0}`);

    // Extrair nós do graph (apenas nós de envio de mensagem)
    const graph = campaign.graph as any;
    const flowNodes = (graph.nodes || [])
      .filter((n: any) => ['text', 'image', 'video', 'audio', 'document', 'action'].includes(n.data?.nodeType))
      .map((n: any) => ({
        id: n.id,
        type: n.data?.nodeType || 'unknown',
        label: n.data?.label || n.data?.config?.content?.substring(0, 30) || `${n.data?.nodeType} node`,
      }));

    console.log(`📋 Extracted ${flowNodes.length} flow nodes from graph`);

    // Estatísticas baseadas nas sessões
    const sessions = campaign.contactSessions || [];
    const stats = {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'ACTIVE').length,
      completed: sessions.filter(s => s.status === 'COMPLETED').length,
      failed: sessions.filter(s => s.status === 'FAILED').length,
      expired: sessions.filter(s => s.status === 'EXPIRED').length,
    };

    // Preparar lista de sessões para exibição (similar ao formato de messages)
    const sessionsList = sessions.map(session => {
      const visitedNodes = (session.visitedNodes as any[]) || [];

      // Criar mapa de nós visitados para fácil acesso
      const nodesMap: Record<string, { sent: boolean; visitedAt?: string; error?: string }> = {};
      visitedNodes.forEach((vn: any) => {
        nodesMap[vn.nodeId] = {
          sent: vn.sent,
          visitedAt: vn.visitedAt,
          error: vn.error,
        };
      });

      return {
        id: session.id,
        contactId: session.contactId,
        contactName: session.contact.nome,
        contactPhone: session.contactPhone,
        status: session.status,
        currentNodeId: session.currentNodeId,
        lastMessageAt: session.lastMessageAt,
        lastResponse: session.lastResponse,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        visitedNodes: nodesMap, // Mapa de nodeId -> {sent, visitedAt, error}
      };
    });

    // Agrupar por status (similar a messagesBySession)
    const sessionsByStatus = {
      'Ativas': {
        sessions: sessionsList.filter(s => s.status === 'ACTIVE'),
      },
      'Concluídas': {
        sessions: sessionsList.filter(s => s.status === 'COMPLETED'),
      },
      'Falhadas': {
        sessions: sessionsList.filter(s => s.status === 'FAILED'),
      },
      'Expiradas': {
        sessions: sessionsList.filter(s => s.status === 'EXPIRED'),
      },
    };

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        scheduledDate: campaign.scheduledDate,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        connection: campaign.connection,
        sessions: sessionsList,
      },
      stats,
      sessionsByStatus,
      flowNodes, // Lista de nós do fluxo
    };
  },
};
