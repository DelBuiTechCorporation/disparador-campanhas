import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { ContactService } from '../services/contactService';
import { CategoryService } from '../services/categoryService';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Validation rules
export const campaignValidation = [
  body('nome').notEmpty().withMessage('Nome da campanha é obrigatório'),
  body('targetTags').isArray().withMessage('Categorias dos contatos devem ser um array'),
  body('sessionNames').isArray({ min: 1 }).withMessage('Pelo menos uma sessão WhatsApp deve ser selecionada'),
  body('messageType').isIn(['text', 'image', 'video', 'audio', 'document', 'sequence', 'openai', 'groq', 'wait']).withMessage('Tipo de mensagem inválido'),
  body('messageContent').notEmpty().withMessage('Conteúdo da mensagem é obrigatório'),
  body('randomDelay').isInt({ min: 0 }).withMessage('Delay deve ser um número positivo'),
  body('startImmediately').isBoolean().withMessage('StartImmediately deve ser boolean'),
  body('scheduledFor').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Data de agendamento deve ser válida')
];

// List all campaigns
export const listCampaigns = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Filtros base
    const where: any = {};

    // Filtro por tenant (sempre aplicar quando tenantId existe)
    if (req.tenantId) {
      where.tenantId = req.tenantId;
    }

    // Filtro de busca
    if (search) {
      where.nome = {
        contains: String(search),
        mode: 'insensitive'
      };
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          session: {
            select: {
              name: true,
              displayName: true,
              status: true,
              mePushName: true,
              provider: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: {
          criadoEm: 'desc'
        },
        skip,
        take: Number(limit)
      }),
      prisma.campaign.count({ where })
    ]);

    // Parse JSON fields
    const campaignsWithParsedData = campaigns.map(campaign => ({
      ...campaign,
      targetTags: JSON.parse(campaign.targetTags),
      sessionNames: campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [],
      messageContent: JSON.parse(campaign.messageContent)
    }));

    res.json({
      campaigns: campaignsWithParsedData,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Get campaign by ID
export const getCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Construir where com tenant isolation
    const where: any = { id };
    if (req.user?.role !== 'SUPERADMIN') {
      where.tenantId = req.tenantId;
    }

    const campaign = await prisma.campaign.findFirst({
      where,
      include: {
        session: {
          select: {
            name: true,
            status: true,
            mePushName: true,
            provider: true
          }
        },
        messages: {
          orderBy: {
            criadoEm: 'desc'
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Parse JSON fields
    const campaignWithParsedData = {
      ...campaign,
      targetTags: JSON.parse(campaign.targetTags),
      sessionNames: campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [],
      messageContent: JSON.parse(campaign.messageContent)
    };

    res.json(campaignWithParsedData);
  } catch (error) {
    console.error('Erro ao buscar campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Create new campaign
export const createCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      nome,
      targetTags,
      sessionNames,
      messageType,
      messageContent,
      randomDelay,
      startImmediately,
      scheduledFor
    } = req.body;

    // Log detalhado da criação de campanha
    console.log(`🔍 === CRIANDO CAMPANHA ===`);
    console.log(`📝 Nome: ${nome}`);
    console.log(`⏰ startImmediately: ${startImmediately} (tipo: ${typeof startImmediately})`);
    console.log(`📅 scheduledFor (recebido): ${scheduledFor}`);
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      console.log(`📅 scheduledFor (convertido): ${scheduledDate.toISOString()}`);
      console.log(`🕐 Data/hora atual (UTC): ${new Date().toISOString()}`);
      console.log(`⏱️  Diferença: ${scheduledDate.getTime() - Date.now()}ms (${Math.round((scheduledDate.getTime() - Date.now()) / 1000 / 60)} minutos)`);
    }
    console.log(`✅ Status será: ${startImmediately ? 'RUNNING' : 'PENDING'}`);
    console.log(`🔍 =========================`);

    // Verificar se todas as sessões existem e estão ativas (com tenant isolation)
    const sessionWhere: any = {
      name: { in: sessionNames },
      status: 'WORKING'
    };

    if (req.user?.role !== 'SUPERADMIN') {
      sessionWhere.tenantId = req.tenantId;
    }

    const sessions = await prisma.whatsAppSession.findMany({
      where: sessionWhere
    });

    if (sessions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma sessão WhatsApp ativa encontrada nas selecionadas' });
    }

    if (sessions.length < sessionNames.length) {
      const activeSessions = sessions.map(s => s.name);
      const inactiveSessions = sessionNames.filter((name: string) => !activeSessions.includes(name));
      return res.status(400).json({
        error: `As seguintes sessões não estão ativas: ${inactiveSessions.join(', ')}`
      });
    }

    // Buscar contatos usando ContactService com tenant isolation
    const tenantId = req.tenantId;

    // Buscar contatos que pertencem às categorias selecionadas
    const whereContacts: any = {
      categoriaId: { in: targetTags },
      tenantId: tenantId
    };

    const filteredContacts = await prisma.contact.findMany({
      where: whereContacts,
      select: {
        id: true,
        nome: true,
        telefone: true,
        categoriaId: true
      }
    });

    console.log(`📊 Categorias selecionadas:`, targetTags);
    console.log(`📊 Contatos encontrados com essas categorias:`, filteredContacts.length);

    if (filteredContacts.length === 0) {
      return res.status(400).json({ error: 'Nenhum contato encontrado com as categorias selecionadas' });
    }

    // Criar campanha
    const campaign = await prisma.campaign.create({
      data: {
        nome,
        targetTags: JSON.stringify(targetTags),
        sessionNames: JSON.stringify(sessionNames),
        sessionName: sessionNames[0], // Para compatibilidade
        messageType,
        messageContent: JSON.stringify(messageContent),
        randomDelay,
        startImmediately,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        totalContacts: filteredContacts.length,
        status: startImmediately ? 'RUNNING' : 'PENDING',
        startedAt: startImmediately ? new Date() : null,
        createdBy: req.user?.id,
        createdByName: req.user?.nome,
        tenantId: req.tenantId
      }
    });

    // Criar mensagens para cada contato filtrado
    const campaignMessages = filteredContacts.map((contact: any) => ({
      campaignId: campaign.id,
      contactId: contact.id,
      contactPhone: contact.telefone,
      contactName: contact.nome,
      tenantId: campaign.tenantId
    }));

    await prisma.campaignMessage.createMany({
      data: campaignMessages
    });

    res.status(201).json({
      message: 'Campanha criada com sucesso',
      campaign: {
        ...campaign,
        targetTags: JSON.parse(campaign.targetTags),
        sessionNames: campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [],
        messageContent: JSON.parse(campaign.messageContent)
      }
    });
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Update campaign
export const updateCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Se há targetTags, converter para JSON
    if (updateData.targetTags) {
      updateData.targetTags = JSON.stringify(updateData.targetTags);
    }

    // Se há sessionNames, converter para JSON
    if (updateData.sessionNames) {
      updateData.sessionNames = JSON.stringify(updateData.sessionNames);
    }

    // Se há messageContent, converter para JSON
    if (updateData.messageContent) {
      updateData.messageContent = JSON.stringify(updateData.messageContent);
    }

    // Se há scheduledFor, converter para Date
    if (updateData.scheduledFor) {
      updateData.scheduledFor = new Date(updateData.scheduledFor);
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Campanha atualizada com sucesso',
      campaign: {
        ...campaign,
        targetTags: JSON.parse(campaign.targetTags),
        sessionNames: campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [],
        messageContent: JSON.parse(campaign.messageContent)
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Delete campaign
export const deleteCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha existe e pertence ao tenant
    const where: any = { id };
    if (req.user?.role !== 'SUPERADMIN') {
      where.tenantId = req.tenantId;
    }

    const campaign = await prisma.campaign.findFirst({ where });
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await prisma.campaign.delete({
      where: { id }
    });

    res.json({ message: 'Campanha removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Pause/Resume campaign
export const toggleCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'pause' or 'resume'

    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    const newStatus = action === 'pause' ? 'PAUSED' : 'RUNNING';

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: newStatus,
        startedAt: action === 'resume' && !campaign.startedAt ? new Date() : campaign.startedAt
      }
    });

    res.json({
      message: `Campanha ${action === 'pause' ? 'pausada' : 'retomada'} com sucesso`,
      campaign: updatedCampaign
    });
  } catch (error) {
    console.error('Erro ao alterar status da campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Get campaign report
export const getCampaignReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Buscando relatório para campanha: ${id}`);

    // Buscar campanha com todas as mensagens e estatísticas
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            contactId: true,
            contactPhone: true,
            contactName: true,
            status: true,
            sentAt: true,
            errorMessage: true,
            sessionName: true,
            selectedVariation: true,
            criadoEm: true
          }
        },
        session: {
          select: {
            name: true,
            mePushName: true,
            status: true,
            provider: true
          }
        }
      }
    });

    if (!campaign) {
      console.log(`❌ Campanha ${id} não encontrada`);
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    console.log(`✅ Campanha encontrada: ${campaign.nome}`);
    console.log(`📊 Total de mensagens na campanha: ${campaign.messages?.length || 0}`);

    if (campaign.messages && campaign.messages.length > 0) {
      console.log('🔍 Primeiras 3 mensagens:', campaign.messages.slice(0, 3));
    }

    // Buscar informações de todas as sessões utilizadas nas mensagens
    const sessionNames = [...new Set(campaign.messages.map(m => m.sessionName).filter(Boolean))] as string[];

    let sessionsInfo: any[] = [];
    let sessionProviderMap: any = {};

    if (sessionNames.length > 0) {
      try {
        sessionsInfo = await prisma.whatsAppSession.findMany({
          where: {
            name: { in: sessionNames }
          },
          select: {
            name: true,
            provider: true,
            mePushName: true,
            status: true
          }
        });

        // Criar um mapa de sessão para provider
        sessionProviderMap = sessionsInfo.reduce((acc: any, session) => {
          acc[session.name] = {
            provider: session.provider || 'WAHA',
            mePushName: session.mePushName,
            status: session.status
          };
          return acc;
        }, {});
      } catch (error) {
        console.error('Erro ao buscar informações das sessões:', error);
        // Em caso de erro, criar mapa vazio - as mensagens mostrarão provider como N/A
      }
    }

    // Adicionar informações de provider às mensagens
    const messagesWithProvider = campaign.messages.map(message => ({
      ...message,
      sessionProvider: message.sessionName ? sessionProviderMap[message.sessionName]?.provider || 'WAHA' : 'N/A',
      sessionDisplayName: message.sessionName ? `${message.sessionName} (${sessionProviderMap[message.sessionName]?.provider || 'WAHA'})` : 'N/A'
    }));

    // Estatísticas detalhadas
    const stats = {
      total: messagesWithProvider.length,
      sent: messagesWithProvider.filter(m => m.status === 'SENT').length,
      failed: messagesWithProvider.filter(m => m.status === 'FAILED').length,
      pending: messagesWithProvider.filter(m => m.status === 'PENDING').length
    };

    // Agrupar por status
    const messagesByStatus = {
      sent: messagesWithProvider.filter(m => m.status === 'SENT'),
      failed: messagesWithProvider.filter(m => m.status === 'FAILED'),
      pending: messagesWithProvider.filter(m => m.status === 'PENDING')
    };

    // Agrupar por sessão utilizada com informações de provider
    const messagesBySession = messagesWithProvider.reduce((acc: any, message) => {
      const sessionKey = message.sessionName || 'N/A';
      const sessionInfo = sessionProviderMap[sessionKey];
      const sessionDisplayKey = sessionKey === 'N/A' ? 'N/A' : `${sessionKey} (${sessionInfo?.provider || 'WAHA'})`;

      if (!acc[sessionDisplayKey]) {
        acc[sessionDisplayKey] = {
          sessionName: sessionKey,
          provider: sessionInfo?.provider || 'WAHA',
          mePushName: sessionInfo?.mePushName || null,
          status: sessionInfo?.status || null,
          messages: []
        };
      }
      acc[sessionDisplayKey].messages.push(message);
      return acc;
    }, {});

    // Parse JSON fields with error handling
    let targetTags: any[] = [];
    let sessionNamesArray: string[] = [];
    let messageContent: any = {};

    try {
      targetTags = JSON.parse(campaign.targetTags);
    } catch (error) {
      console.error('Erro ao fazer parse das targetTags:', error);
      targetTags = [];
    }

    try {
      sessionNamesArray = campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [];
    } catch (error) {
      console.error('Erro ao fazer parse dos sessionNames:', error);
      sessionNamesArray = [];
    }

    try {
      messageContent = JSON.parse(campaign.messageContent);
      console.log('✅ MessageContent parsed successfully:', messageContent);
    } catch (error) {
      console.error('❌ Erro ao fazer parse do messageContent:', error);
      console.error('❌ Original messageContent:', campaign.messageContent);
      messageContent = {};
    }

    const campaignWithParsedData = {
      ...campaign,
      targetTags,
      sessionNames: sessionNamesArray,
      messageContent,
      messages: messagesWithProvider // Substitui as mensagens originais pelas com informações de provider
    };

    const report = {
      campaign: campaignWithParsedData,
      stats,
      messagesByStatus,
      messagesBySession,
      sessionsInfo: sessionProviderMap, // Adiciona informações das sessões
      generatedAt: new Date().toISOString()
    };

    res.json(report);
  } catch (error) {
    console.error('Erro ao gerar relatório da campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Get available contact tags (categories)
export const getContactTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Buscar categorias usando CategoryService com tenant isolation
    const tenantId = req.tenantId;
    const categoriesResponse = await CategoryService.getCategories(undefined, 1, 999999, tenantId);

    // Retornar array com id e nome das categorias
    const tags = categoriesResponse.categories.map((categoria: any) => ({
      id: categoria.id,
      nome: categoria.nome
    }));

    res.json(tags);
  } catch (error) {
    console.error('Erro ao buscar tags:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Get active WhatsApp sessions
export const getActiveSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Filtro base
    const where: any = {
      status: 'WORKING'
    };

    // Filtrar por tenant (sempre aplicar quando tenantId existe)
    if (req.tenantId) {
      where.tenantId = req.tenantId;
    }

    const sessions = await prisma.whatsAppSession.findMany({
      where,
      select: {
        name: true,
        displayName: true,
        mePushName: true,
        meId: true,
        provider: true
      }
    });

    res.json(sessions);
  } catch (error) {
    console.error('Erro ao buscar sessões ativas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const downloadCampaignReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const XLSX = require('xlsx');

    // Buscar campanha com mensagens
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { criadoEm: 'asc' },
          select: {
            contactName: true,
            contactPhone: true,
            status: true,
            sentAt: true,
            errorMessage: true,
            sessionName: true,
            selectedVariation: true,
            criadoEm: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Preparar dados para o Excel
    const data = campaign.messages.map(msg => ({
      'Nome': msg.contactName || 'N/A',
      'Telefone': msg.contactPhone || 'N/A',
      'Status': msg.status === 'SENT' ? 'Enviado' : msg.status === 'FAILED' ? 'Falhou' : 'Pendente',
      'Data de Envio': msg.sentAt ? new Date(msg.sentAt).toLocaleString('pt-BR') : 'N/A',
      'Sessão': msg.sessionName || 'N/A',
      'Variação': msg.selectedVariation !== null && msg.selectedVariation !== undefined ? msg.selectedVariation.toString() : 'N/A',
      'Erro': msg.errorMessage || 'N/A'
    }));

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Definir largura das colunas
    ws['!cols'] = [
      { wch: 25 },  // Nome
      { wch: 18 },  // Telefone
      { wch: 12 },  // Status
      { wch: 20 },  // Data de Envio
      { wch: 25 },  // Sessão
      { wch: 10 },  // Variação
      { wch: 50 }   // Erro
    ];

    // Aplicar estilos ao cabeçalho (células A1 até G1)
    const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'];
    headerCells.forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "1E3A5F" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
    });

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Definir headers para download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${campaign.nome}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length.toString());

    res.end(excelBuffer);
  } catch (error) {
    console.error('Erro ao gerar XLSX:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório XLSX' });
  }
};