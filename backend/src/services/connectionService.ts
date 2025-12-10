import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface CreateConnectionDto {
  provider: 'EVOLUTION' | 'WAHA' | 'QUEPASA';
  instanceName: string;
  phoneNumber: string;
  tenantId?: string;
}

export interface UpdateConnectionDto {
  status?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  phoneNumber?: string;
}

export const connectionService = {
  /**
   * Cria uma nova conexão e gera webhook secret e callback URL
   */
  async createConnection(data: CreateConnectionDto) {
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const baseUrl = process.env.APP_URL || 'http://localhost:3001';

    const connection = await prisma.connection.create({
      data: {
        provider: data.provider,
        instanceName: data.instanceName,
        phoneNumber: data.phoneNumber,
        status: 'ACTIVE',
        webhookSecret,
        callbackUrl: '', // será preenchido após criar
        tenantId: data.tenantId,
      },
    });

    // Atualizar com a callback URL que inclui o ID
    const callbackUrl = `${baseUrl}/api/webhooks/wa/${connection.id}/callback`;

    const updatedConnection = await prisma.connection.update({
      where: { id: connection.id },
      data: { callbackUrl },
    });

    return updatedConnection;
  },

  /**
   * Lista todas as conexões (com filtro opcional por tenant)
   * Busca tanto da tabela Connection (nova) quanto WhatsAppSession (antiga) para compatibilidade
   */
  async listConnections(tenantId?: string) {
    // Buscar da tabela Connection (nova)
    const connections = await prisma.connection.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    // Buscar também da tabela WhatsAppSession (antiga) para compatibilidade
    const whatsappSessions = await prisma.whatsAppSession.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
        provider: true,
        tenantId: true,
        meJid: true,
      },
    });

    // Converter WhatsAppSessions para o formato de Connection
    const sessionsAsConnections = whatsappSessions.map((session) => ({
      id: session.id,
      provider: session.provider || 'WAHA',
      instanceName: session.name,
      phoneNumber: session.meJid || session.displayName || session.name,
      status: session.status === 'WORKING' ? 'ACTIVE' : session.status === 'ERROR' ? 'ERROR' : 'INACTIVE',
      webhookSecret: '',
      callbackUrl: '',
      tenantId: session.tenantId || null,
      createdAt: new Date(), // WhatsAppSession usa criadoEm, mas não temos acesso aqui
      updatedAt: new Date(),
    }));

    // Mesclar resultados (Connection tem prioridade)
    const allConnections = [...connections, ...sessionsAsConnections];

    return allConnections;
  },

  /**
   * Busca uma conexão por ID
   * Tenta primeiro na tabela Connection (nova), depois WhatsAppSession (antiga)
   */
  async getConnection(id: string) {
    // Tentar buscar da tabela Connection
    const connection = await prisma.connection.findUnique({
      where: { id },
      include: {
        campaigns: true,
        webhookSubscriptions: true,
      },
    });

    if (connection) {
      return connection;
    }

    // Se não encontrou, buscar da WhatsAppSession (antiga)
    const session = await prisma.whatsAppSession.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
        provider: true,
        tenantId: true,
        meJid: true,
      },
    });

    if (!session) {
      return null;
    }

    // Converter para formato de Connection
    return {
      id: session.id,
      provider: session.provider || 'WAHA',
      instanceName: session.name,
      phoneNumber: session.meJid || session.displayName || session.name,
      status: session.status === 'WORKING' ? 'ACTIVE' : session.status === 'ERROR' ? 'ERROR' : 'INACTIVE',
      webhookSecret: '',
      callbackUrl: '',
      tenantId: session.tenantId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      campaigns: [],
      webhookSubscriptions: [],
    };
  },

  /**
   * Atualiza uma conexão
   */
  async updateConnection(id: string, data: UpdateConnectionDto) {
    return prisma.connection.update({
      where: { id },
      data,
    });
  },

  /**
   * Deleta uma conexão
   */
  async deleteConnection(id: string) {
    return prisma.connection.delete({
      where: { id },
    });
  },

  /**
   * Valida HMAC signature do webhook
   */
  validateHmacSignature(signature: string, body: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      const receivedSignature = signature.replace('sha256=', '');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  },
};
