import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChatwootService } from '../services/chatwootService';

const chatwootService = new ChatwootService();



// SSE stream para tags
export const streamChatwootTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Para SUPERADMIN, permitir tenantId via query parameter
    let tenantId = req.tenantId;
    
    if (req.user?.role === 'SUPERADMIN' && req.query.tenantId) {
      tenantId = req.query.tenantId as string;
    }
    
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'TenantID não encontrado',
        message: 'SUPERADMIN deve fornecer tenantId como query parameter'
      });
    }

    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (event: string, data: any) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    let connectionClosed = false;

    // Detectar quando conexão é fechada
    res.on('close', () => {
      connectionClosed = true;
      chatwootService.cancelSync(tenantId);
    });

    req.on('close', () => {
      connectionClosed = true;
      chatwootService.cancelSync(tenantId);
    });

    // Iniciar carregamento em background
    (async () => {
      try {
        const tagsMap = new Map<string, number>();

        // Callback para receber tags conforme são carregadas
        const onTagUpdate = (tags: Array<{ name: string; count: number }>) => {
          if (connectionClosed || res.writableEnded) return;

          tags.forEach(tag => tagsMap.set(tag.name, tag.count));

          sendEvent('tags_update', {
            tags: Array.from(tagsMap.entries()).map(([name, count]) => ({ name, count })),
            total: tagsMap.size
          });
        };

        // Obter tags com callback de progresso
        const allTags = await chatwootService.getTagsWithCallback(tenantId, onTagUpdate);

        if (!connectionClosed && !res.writableEnded) {
          sendEvent('tags_complete', {
            tags: allTags,
            total: allTags.length
          });
          res.end();
        }
      } catch (error: any) {
        if (!connectionClosed && !res.writableEnded) {
          sendEvent('tags_error', { error: error.message });
          res.end();
        }
      }
    })();

  } catch (error: any) {
    console.error('Erro ao iniciar stream de tags:', error);
    if (!res.writableEnded) {
      res.status(500).json({
        error: 'Erro ao iniciar stream de tags',
        message: error.message
      });
    }
  }
};


