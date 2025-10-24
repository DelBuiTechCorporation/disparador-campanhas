import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChatwootService } from '../services/chatwootService';

const chatwootService = new ChatwootService();

export const getChatwootTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'TenantID não encontrado' });
    }

    const tags = await chatwootService.getTags(tenantId);
    res.json({ tags });
  } catch (error: any) {
    console.error('Erro ao buscar tags do Chatwoot:', error);

    // Se for erro de configuração, retornar 400 ao invés de 500
    if (error.message && error.message.includes('não está configurado')) {
      return res.status(400).json({
        error: 'Chatwoot não configurado',
        message: 'Configure o Chatwoot na página de Integrações antes de sincronizar contatos.'
      });
    }

    res.status(500).json({
      error: 'Erro ao buscar tags do Chatwoot',
      message: error.message
    });
  }
};

export const syncChatwootContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'TenantID não encontrado' });
    }

    const { tagMappings } = req.body;

    if (!tagMappings || !Array.isArray(tagMappings) || tagMappings.length === 0) {
      return res.status(400).json({ error: 'Tag mappings são obrigatórios' });
    }

    const result = await chatwootService.syncContacts(tenantId, tagMappings);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao sincronizar contatos do Chatwoot:', error);
    res.status(500).json({
      error: 'Erro ao sincronizar contatos',
      message: error.message
    });
  }
};
