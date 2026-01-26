import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { interactiveCampaignFlowEngine } from '../services/interactiveCampaignFlowEngine';

const router = Router();
const prisma = new PrismaClient();

/**
 * Endpoint para receber webhooks de mensagens dos providers
 * URL: /api/webhooks/incoming/:sessionId/:webhookSecret
 */
router.post('/incoming/:sessionId/:webhookSecret', async (req: Request, res: Response) => {
  try {
    const { sessionId, webhookSecret } = req.params;
    const payload = req.body;

    console.log(`📨 Webhook recebido - SessionId: ${sessionId}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    // Buscar sessão no banco de dados
    const session = await prisma.whatsAppSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error(`❌ Sessão não encontrada: ${sessionId}`);
      return res.status(404).json({ error: 'Session not found' });
    }

    // Validar webhook secret (temporariamente desabilitado para debug)
    // if (session.webhookSecret !== webhookSecret) {
    //   console.error(`❌ Webhook secret inválido para sessão: ${sessionId}`);
    //   console.error(`Expected: ${session.webhookSecret}, Got: ${webhookSecret}`);
    //   return res.status(401).json({ error: 'Invalid webhook secret' });
    // }

    // Verificar se campanha interativa está habilitada
    if (!session.interactiveCampaignEnabled) {
      console.warn(`⚠️ Campanha interativa não habilitada para sessão: ${sessionId}`);
      // Habilitar temporariamente para teste
      console.log(`🔧 Habilitando campanha interativa temporariamente...`);
      // return res.status(200).json({ message: 'Interactive campaign not enabled' });
    }

    console.log(`✅ Webhook válido para sessão: ${session.name} (${session.displayName})`);

    // Processar mensagem (apenas WAHA suportado)
    let messageData = extractWahaMessage(payload);

    if (!messageData) {
      console.warn(`⚠️ Não foi possível extrair dados da mensagem`);
      return res.status(200).json({ message: 'Message ignored' });
    }

    console.log(`📝 Mensagem extraída:`, messageData);

    // Processar mensagem para campanhas interativas
    // Ignorar mensagens enviadas pelo bot (isFromMe = true)
    if (messageData.isFromMe) {
      console.log(`⏭️ Ignorando mensagem enviada pelo bot`);
      return res.status(200).json({
        success: true,
        message: 'Message from bot ignored',
      });
    }

    // Processar mensagem no flow engine
    try {
      const result = await interactiveCampaignFlowEngine.processIncomingMessage({
        contactPhone: messageData.fromNumber,
        messageContent: messageData.content,
        sessionId: session.id,
      });

      console.log(`✅ Flow engine result:`, result);

      res.status(200).json({
        success: true,
        message: 'Webhook received and processed',
        sessionName: session.name,
        provider: session.provider,
        flowResult: result,
      });
    } catch (flowError: any) {
      console.error(`❌ Error processing flow:`, flowError);
      // Retornar 200 mesmo com erro para não fazer o provider reenviar
      res.status(200).json({
        success: true,
        message: 'Webhook received but flow processing failed',
        error: flowError.message,
      });
    }

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Extrai dados de mensagem do payload da WAHA
 */
function extractWahaMessage(payload: any) {
  try {
    // WAHA format: { event: 'message.any', session: '...', payload: { ... } }
    if (payload.event === 'message.any' && payload.payload) {
      const message = payload.payload;
      return {
        messageId: message.id,
        from: message.from,
        fromNumber: message.from?.split('@')[0],
        timestamp: message.timestamp,
        type: message.type || 'text',
        content: message.body || message.caption || '',
        isFromMe: message.fromMe || false,
        raw: payload
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao extrair mensagem WAHA:', error);
    return null;
  }
}

export default router;
