import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IncomingMessageDto {
  providerMessageId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  from: string;
  to: string;
  content?: string;
  timestamp: number;
  raw?: any;
}

export const messageService = {
  /**
   * Salva uma mensagem (com idempotência por providerMessageId)
   */
  async saveMessage(connectionId: string, data: IncomingMessageDto) {
    // Verificar se já existe (idempotência)
    const existing = await prisma.message.findUnique({
      where: { providerMessageId: data.providerMessageId },
    });

    if (existing) {
      return { message: existing, isNew: false };
    }

    // Criar nova mensagem
    const message = await prisma.message.create({
      data: {
        connectionId,
        direction: data.direction,
        type: data.type,
        providerMessageId: data.providerMessageId,
        fromNumber: data.from,
        toNumber: data.to,
        content: data.content,
        payload: data.raw || {},
        status: 'received',
        timestamp: new Date(data.timestamp),
      },
    });

    return { message, isNew: true };
  },

  /**
   * Lista mensagens de uma conexão
   */
  async listMessages(connectionId: string, limit = 100) {
    return prisma.message.findMany({
      where: { connectionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },

  /**
   * Busca mensagem por providerMessageId
   */
  async getMessageByProviderId(providerMessageId: string) {
    return prisma.message.findUnique({
      where: { providerMessageId },
    });
  },
};
