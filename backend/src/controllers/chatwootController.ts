import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChatwootService } from '../services/chatwootService';

const chatwootService = new ChatwootService();

// POST /api/chatwoot/import - Importar contatos por tags
export const importContactsByTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('📥 POST /api/chatwoot/import - Iniciando importação...');
    const { tagMappings } = req.body;

    if (!tagMappings || !Array.isArray(tagMappings) || tagMappings.length === 0) {
      console.log('❌ Tag mappings inválidos ou vazios');
      return res.status(400).json({
        error: 'Tag mappings são obrigatórios',
        message: 'Envie um array de { chatwootTag, categoryId }'
      });
    }

    // Para SUPERADMIN, permitir tenantId via body
    let tenantId = req.tenantId;
    
    if (req.user?.role === 'SUPERADMIN' && req.body.tenantId) {
      tenantId = req.body.tenantId;
    }
    
    if (!tenantId) {
      console.log('❌ TenantID não encontrado');
      return res.status(400).json({ 
        error: 'TenantID não encontrado',
        message: 'SUPERADMIN deve fornecer tenantId no body'
      });
    }

    // Importar contatos
    console.log(`🔄 Iniciando importação de contatos para ${tagMappings.length} tag(s)...`);
    tagMappings.forEach((mapping: any) => {
      console.log(`  📋 Tag: "${mapping.chatwootTag}" → Categoria: ${mapping.categoryId}`);
    });
    
    const result = await chatwootService.syncContacts(tenantId, tagMappings);

    console.log(`✅ Importação concluída - Enviando resposta JSON`);
    res.json({
      success: true,
      data: result,
      message: `${result.imported} contatos importados, ${result.updated} atualizados`
    });

  } catch (error: any) {
    console.error('❌ Erro ao importar contatos:', error);
    res.status(500).json({
      error: 'Erro ao importar contatos',
      message: error.message
    });
  }
};


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


// DELETE /api/chatwoot/cache - Limpar cache de contatos
export const clearChatwootCache = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Para SUPERADMIN, permitir tenantId via body
    let tenantId = req.tenantId;
    
    if (req.user?.role === 'SUPERADMIN' && req.body.tenantId) {
      tenantId = req.body.tenantId;
    }
    
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'TenantID não encontrado',
        message: 'SUPERADMIN deve fornecer tenantId no body'
      });
    }

    chatwootService.clearCache(tenantId);

    res.json({
      success: true,
      message: 'Cache limpo com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      error: 'Erro ao limpar cache',
      message: error.message
    });
  }
};

// POST /api/chatwoot/validate-token - Validar token e buscar accounts disponíveis
export const validateChatwootToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔑 POST /api/chatwoot/validate-token - Validando token...');
    const { chatwootUrl, chatwootApiToken } = req.body;

    if (!chatwootUrl || !chatwootApiToken) {
      console.log('❌ URL ou token não fornecidos');
      return res.status(400).json({
        success: false,
        message: 'URL do Chatwoot e Token de API são obrigatórios'
      });
    }

    // Validar formato da URL
    try {
      new URL(chatwootUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'URL do Chatwoot inválida'
      });
    }

    // Buscar perfil do usuário e accounts disponíveis
    const profileUrl = `${chatwootUrl}/api/v1/profile`;
    console.log(`🌐 Validando token em: ${profileUrl}`);

    const response = await fetch(profileUrl, {
      headers: {
        'api_access_token': chatwootApiToken
      }
    });

    if (!response.ok) {
      console.log(`❌ Erro ao validar token: ${response.status}`);
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou URL incorreta'
      });
    }

    const profileData: any = await response.json();
    console.log(`✅ Token válido - ${profileData.accounts?.length || 0} account(s) encontrada(s)`);

    // Extrair accounts disponíveis
    const accounts = (profileData.accounts || []).map((account: any) => ({
      id: account.id,
      name: account.name,
      role: account.role,
      status: account.status
    }));

    res.json({
      success: true,
      data: {
        userName: profileData.name || profileData.display_name || profileData.email,
        email: profileData.email,
        accounts: accounts
      },
      message: `${accounts.length} conta(s) disponível(is)`
    });

  } catch (error: any) {
    console.error('❌ Erro ao validar token Chatwoot:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar token. Verifique a URL e tente novamente.',
      error: error.message
    });
  }
};
