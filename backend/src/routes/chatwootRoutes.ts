import { Router } from 'express';
import { streamChatwootTags, importContactsByTags, clearChatwootCache, validateChatwootToken } from '../controllers/chatwootController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// POST /api/chatwoot/validate-token - Validar token e buscar accounts
router.post('/validate-token', validateChatwootToken);

// GET /api/chatwoot/tags/stream - Stream de tags em tempo real (SSE)
router.get('/tags/stream', streamChatwootTags);

// POST /api/chatwoot/import - Importar contatos por tags
router.post('/import', importContactsByTags);

// DELETE /api/chatwoot/cache - Limpar cache de conversas
router.delete('/cache', clearChatwootCache);

export default router;
