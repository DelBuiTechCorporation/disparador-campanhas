import { Request, Response } from 'express';
import { connectionService } from '../services/connectionService';
import { messageService, IncomingMessageDto } from '../services/messageService';

export const webhookController = {
  /**
   * POST /api/webhooks/wa/:connectionId/callback
   * Recebe mensagens inbound/outbound do provedor WhatsApp
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const signature = req.headers['x-signature'] as string;
      const rawBody = JSON.stringify(req.body);

      // Buscar conexão
      const connection = await connectionService.getConnection(connectionId);

      if (!connection) {
        return res.status(404).json({ error: 'Conexão não encontrada' });
      }

      // Validar HMAC signature
      if (!signature) {
        return res.status(401).json({ error: 'Assinatura ausente' });
      }

      const isValid = connectionService.validateHmacSignature(
        signature,
        rawBody,
        connection.webhookSecret
      );

      if (!isValid) {
        console.warn(`Invalid HMAC signature for connection ${connectionId}`);
        return res.status(401).json({ error: 'Assinatura inválida' });
      }

      // Normalizar mensagem de diferentes provedores
      const messageData = normalizeWebhookPayload(req.body, connection.provider);

      if (!messageData) {
        // Evento não é uma mensagem (ex: status change, typing, etc)
        return res.status(200).json({ ok: true });
      }

      // Salvar mensagem (com idempotência)
      const { message, isNew } = await messageService.saveMessage(
        connectionId,
        messageData
      );

      // Se mensagem nova E inbound, processar fluxos
      if (isNew && messageData.direction === 'INBOUND') {
        console.log(`Nova mensagem INBOUND: ${message.id}`);

        // Processar assincronamente (não bloquear resposta do webhook)
        const { messageProcessorService } = await import('../services/messageProcessorService');

        setImmediate(() => {
          messageProcessorService.processInboundMessage({
            messageId: message.id,
            connectionId,
            from: messageData.from,
            to: messageData.to,
            content: messageData.content,
            type: messageData.type,
            timestamp: new Date(messageData.timestamp),
          }).catch(error => {
            console.error('Error processing inbound message:', error);
          });
        });
      }

      return res.status(200).json({ ok: true, messageId: message.id });
    } catch (error: any) {
      console.error('Error handling webhook callback:', error);
      return res.status(500).json({ error: error.message });
    }
  },
};

/**
 * Normaliza payload de diferentes provedores para formato padrão
 */
function normalizeWebhookPayload(
  payload: any,
  provider: string
): IncomingMessageDto | null {
  try {
    // Formato genérico esperado (baseado em Evolution/WAHA)
    if (payload.event === 'messages.upsert' || payload.event === 'message') {
      const msg = payload.data || payload.message || payload;

      return {
        providerMessageId: msg.key?.id || msg.id || msg.messageId,
        direction: msg.key?.fromMe || msg.fromMe ? 'OUTBOUND' : 'INBOUND',
        type: msg.messageType || msg.type || 'text',
        from: msg.key?.remoteJid || msg.from || msg.chatId,
        to: msg.pushName || msg.to || '',
        content: extractMessageContent(msg),
        timestamp: msg.messageTimestamp
          ? parseInt(msg.messageTimestamp) * 1000
          : Date.now(),
        raw: payload,
      };
    }

    // Outros eventos (status, typing, etc) - ignorar
    return null;
  } catch (error) {
    console.error('Error normalizing webhook payload:', error);
    return null;
  }
}

/**
 * Extrai conteúdo da mensagem de diferentes tipos
 */
function extractMessageContent(msg: any): string | undefined {
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text)
    return msg.message.extendedTextMessage.text;
  if (msg.text) return msg.text;
  if (msg.content) return msg.content;
  if (msg.body) return msg.body;

  // Para outros tipos (imagem, audio, etc), retornar caption ou tipo
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.caption) return msg.caption;

  return undefined;
}
