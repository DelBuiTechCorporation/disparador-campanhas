import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    tenantId: string | null;
    role: string;
  };
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://localhost:3000',
          'https://work.trecofantastico.com.br'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    // Middleware de autenticação para WebSocket
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          console.error('❌ WebSocket: Token não fornecido');
          return next(new Error('Token não fornecido'));
        }

        console.log('🔍 WebSocket: Token recebido, verificando...');
        const decoded = jwt.verify(token as string, process.env.JWT_SECRET || 'defaultsecret') as any;

        console.log('🔍 JWT decoded:', JSON.stringify(decoded, null, 2));

        // O JWT pode ter userId ao invés de id
        const userId = decoded.id || decoded.userId;

        if (!userId) {
          console.error('❌ JWT não contém id nem userId. Decoded:', JSON.stringify(decoded, null, 2));
          return next(new Error('Token inválido - ID não encontrado'));
        }

        console.log('✅ UserId extraído:', userId);

        // Busca dados do usuário no banco
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            tenantId: true,
            role: true,
            ativo: true
          }
        });

        if (!user || !user.ativo) {
          return next(new Error('Usuário não encontrado ou inativo'));
        }

        socket.user = {
          id: user.id,
          tenantId: user.tenantId,
          role: user.role
        };

        next();
      } catch (error) {
        console.error('Erro na autenticação WebSocket:', error);
        next(new Error('Token inválido'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 Usuário conectado via WebSocket: ${socket.user?.id} (${socket.id})`);

      if (socket.user) {
        this.addUserConnection(socket.user.id, socket.id);

        // Entra no room do tenant (se houver)
        if (socket.user.tenantId) {
          socket.join(`tenant_${socket.user.tenantId}`);
          console.log(`👥 Usuário ${socket.user.id} entrou no room: tenant_${socket.user.tenantId}`);
        }

        // SuperAdmin entra em room especial
        if (socket.user.role === 'SUPERADMIN') {
          socket.join('superadmin');
          console.log(`🔐 SuperAdmin ${socket.user.id} conectado`);
        }

        // Emite contagem de usuários conectados para o tenant
        this.emitUserCount(socket.user.tenantId);

        // Enviar estado atual das campanhas em execução quando conectar
        console.log(`🔍 DEBUG: socket.user.tenantId = ${socket.user.tenantId}, typeof = ${typeof socket.user.tenantId}`);
        if (socket.user.tenantId) {
          console.log(`🔍 Tentando enviar estado de campanhas para tenant ${socket.user.tenantId}`);
          this.emitCurrentCampaignsState(socket, socket.user.tenantId).catch(err => {
            console.error('❌ Erro ao emitir estado das campanhas:', err);
          });
        } else {
          console.log(`⚠️ Usuário sem tenantId, não enviando estado de campanhas`);
        }
      }

      // Handler para marcar notificação como lida
      socket.on('mark_notification_read', async (notificationId: string) => {
        try {
          if (!socket.user) return;

          await prisma.userNotification.updateMany({
            where: {
              id: notificationId,
              userId: socket.user.id
            },
            data: {
              read: true,
              readAt: new Date()
            }
          });

          // Emite confirmação
          socket.emit('notification_marked_read', { notificationId });

          // Atualiza contador de não lidas
          await this.emitUnreadCount(socket.user.id);

          console.log(`✅ Notificação ${notificationId} marcada como lida por ${socket.user.id}`);
        } catch (error) {
          console.error('Erro ao marcar notificação como lida:', error);
          socket.emit('error', { message: 'Erro ao marcar notificação como lida' });
        }
      });

      // Handler para buscar notificações
      socket.on('get_notifications', async (data: { page?: number; limit?: number }) => {
        try {
          if (!socket.user) return;

          const page = data.page || 1;
          const limit = data.limit || 20;
          const skip = (page - 1) * limit;

          const notifications = await prisma.userNotification.findMany({
            where: { userId: socket.user.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip,
            select: {
              id: true,
              title: true,
              message: true,
              type: true,
              read: true,
              createdAt: true,
              readAt: true,
              data: true
            }
          });

          const total = await prisma.userNotification.count({
            where: { userId: socket.user.id }
          });

          socket.emit('notifications_data', {
            notifications,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            }
          });

        } catch (error) {
          console.error('Erro ao buscar notificações:', error);
          socket.emit('error', { message: 'Erro ao buscar notificações' });
        }
      });

      // Handler para desconexão
      socket.on('disconnect', () => {
        console.log(`🔌 Usuário desconectado: ${socket.user?.id} (${socket.id})`);

        if (socket.user) {
          this.removeUserConnection(socket.user.id, socket.id);
          this.emitUserCount(socket.user.tenantId);
        }
      });
    });

    console.log('🌐 Serviço WebSocket inicializado');
  }

  // Adiciona conexão do usuário
  private addUserConnection(userId: string, socketId: string): void {
    const existing = this.connectedUsers.get(userId) || [];
    existing.push(socketId);
    this.connectedUsers.set(userId, existing);
  }

  // Remove conexão do usuário
  private removeUserConnection(userId: string, socketId: string): void {
    const existing = this.connectedUsers.get(userId) || [];
    const filtered = existing.filter(id => id !== socketId);

    if (filtered.length === 0) {
      this.connectedUsers.delete(userId);
    } else {
      this.connectedUsers.set(userId, filtered);
    }
  }

  // Emite notificação para usuário específico
  public async notifyUser(userId: string, notification: {
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CAMPAIGN' | 'SYSTEM';
    data?: any;
  }): Promise<void> {
    try {
      // Salva notificação no banco
      const savedNotification = await prisma.userNotification.create({
        data: {
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data || null,
          read: false
        }
      });

      if (this.io) {
        // Envia para todas as conexões do usuário
        const userSockets = this.connectedUsers.get(userId) || [];
        userSockets.forEach(socketId => {
          this.io?.to(socketId).emit('new_notification', {
            id: savedNotification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            createdAt: savedNotification.createdAt,
            data: notification.data
          });
        });

        // Atualiza contador de não lidas
        await this.emitUnreadCount(userId);
      }

      console.log(`🔔 Notificação enviada para usuário ${userId}: ${notification.title}`);
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  }

  // Emite notificação para todos os usuários de um tenant
  public async notifyTenant(tenantId: string, notification: {
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CAMPAIGN' | 'SYSTEM';
    data?: any;
  }): Promise<void> {
    try {
      // Busca todos os usuários do tenant
      const users = await prisma.user.findMany({
        where: { tenantId, ativo: true },
        select: { id: true }
      });

      // Envia notificação para cada usuário
      const promises = users.map(user => this.notifyUser(user.id, notification));
      await Promise.all(promises);

      console.log(`🏢 Notificação enviada para tenant ${tenantId}: ${notification.title}`);
    } catch (error) {
      console.error('Erro ao enviar notificação para tenant:', error);
    }
  }

  // Emite notificação para todos os SuperAdmins
  public async notifySuperAdmins(notification: {
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CAMPAIGN' | 'SYSTEM';
    data?: any;
  }): Promise<void> {
    try {
      // Busca todos os SuperAdmins
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPERADMIN', ativo: true },
        select: { id: true }
      });

      // Envia notificação para cada SuperAdmin
      const promises = superAdmins.map(admin => this.notifyUser(admin.id, notification));
      await Promise.all(promises);

      console.log(`👑 Notificação enviada para SuperAdmins: ${notification.title}`);
    } catch (error) {
      console.error('Erro ao enviar notificação para SuperAdmins:', error);
    }
  }

  // Emite evento de progresso de campanha
  public emitCampaignProgress(tenantId: string, campaignData: {
    campaignId: string;
    campaignName: string;
    progress: number;
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    status: string;
    nextShotAt?: number; // Timestamp (Date.now()) do próximo disparo
  }): void {
    if (this.io) {
      this.io.to(`tenant_${tenantId}`).emit('campaign_progress', campaignData);
      const nextShotInfo = campaignData.nextShotAt 
        ? ` (próximo em ${Math.floor((campaignData.nextShotAt - Date.now()) / 1000)}s)` 
        : '';
      console.log(`📊 Progresso de campanha enviado para tenant ${tenantId}: ${campaignData.progress}%${nextShotInfo}`);
    }
  }

  // Emite contagem de usuários conectados
  private emitUserCount(tenantId: string | null): void {
    if (!this.io || !tenantId) return;

    const connectedCount = Array.from(this.connectedUsers.entries())
      .filter(([userId]) => {
        // Aqui seria ideal ter cache dos dados dos usuários conectados
        // Por simplicidade, vamos emitir a contagem total de conexões ativas
        return true;
      }).length;

    this.io.to(`tenant_${tenantId}`).emit('users_online_count', { count: connectedCount });
  }

  // Emite contador de notificações não lidas
  private async emitUnreadCount(userId: string): Promise<void> {
    try {
      const unreadCount = await prisma.userNotification.count({
        where: {
          userId,
          read: false
        }
      });

      if (this.io) {
        const userSockets = this.connectedUsers.get(userId) || [];
        userSockets.forEach(socketId => {
          this.io?.to(socketId).emit('unread_notifications_count', { count: unreadCount });
        });
      }
    } catch (error) {
      console.error('Erro ao emitir contador de não lidas:', error);
    }
  }

  // Emite status do sistema para SuperAdmins
  public emitSystemStatus(status: {
    type: 'campaign' | 'system' | 'database';
    message: string;
    status: 'success' | 'error' | 'warning' | 'info';
    data?: any;
  }): void {
    if (this.io) {
      this.io.to('superadmin').emit('system_status', status);
      console.log(`🖥️ Status do sistema enviado para SuperAdmins: ${status.message}`);
    }
  }

  // Emite estado atual das campanhas em execução quando usuário conecta
  private async emitCurrentCampaignsState(socket: any, tenantId: string): Promise<void> {
    try {
      console.log(`🔍 [emitCurrentCampaignsState] Iniciando para tenant ${tenantId}`);
      
      // Buscar campanhas RUNNING do tenant
      const runningCampaigns = await prisma.campaign.findMany({
        where: {
          tenantId,
          status: 'RUNNING'
        },
        select: {
          id: true,
          nome: true,
          status: true,
          totalContacts: true,
          sentCount: true,
          failedCount: true
        }
      });

      console.log(`🔍 [emitCurrentCampaignsState] Encontradas ${runningCampaigns.length} campanhas RUNNING`);

      if (runningCampaigns.length === 0) {
        return;
      }

      console.log(`📡 Enviando estado atual de ${runningCampaigns.length} campanha(s) para socket ${socket.id}`);

      // Importar campaignSchedulerService para obter countdowns
      const { campaignSchedulerService } = await import('./campaignSchedulerService');
      console.log(`🔍 [emitCurrentCampaignsState] campaignSchedulerService importado:`, typeof campaignSchedulerService);
      
      const countdowns = campaignSchedulerService.getAllCampaignCountdowns();
      console.log(`🔍 [emitCurrentCampaignsState] Countdowns obtidos:`, countdowns.size);

      // Emitir estado de cada campanha
      for (const campaign of runningCampaigns) {
        const progress = Math.round((campaign.sentCount / campaign.totalContacts) * 100);
        const nextShot = countdowns.get(campaign.id);
        
        const payload: any = {
          campaignId: campaign.id,
          campaignName: campaign.nome,
          progress,
          totalContacts: campaign.totalContacts,
          sentCount: campaign.sentCount,
          failedCount: campaign.failedCount,
          status: campaign.status
        };

        // Incluir nextShotAt se existir (em vez de nextShotIn)
        if (nextShot !== undefined && nextShot > 0) {
          // nextShot é o countdown em segundos, converter para timestamp
          payload.nextShotAt = Date.now() + (nextShot * 1000);
          console.log(`⏱️ Campanha ${campaign.id}: próximo disparo em ${nextShot}s (timestamp: ${payload.nextShotAt})`);
        }
        
        socket.emit('campaign_progress', payload);
      }
    } catch (error) {
      console.error('Erro ao emitir estado das campanhas:', error);
    }
  }

  // Getter para verificar se WebSocket está inicializado
  public get isInitialized(): boolean {
    return this.io !== null;
  }

  // Getter para contar conexões ativas
  public get activeConnections(): number {
    return this.connectedUsers.size;
  }
}

// Exporta instância singleton
export const websocketService = WebSocketService.getInstance();