import { Router } from 'express';
import { streamChatwootTags, importContactsByTags, clearChatwootCache } from '../controllers/chatwootController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// GET /api/chatwoot/tags/stream - Stream de tags em tempo real (SSE)
router.get('/tags/stream', streamChatwootTags);

// POST /api/chatwoot/import - Importar contatos por tags
router.post('/import', importContactsByTags);

// DELETE /api/chatwoot/cache - Limpar cache de conversas
router.delete('/cache', clearChatwootCache);

export default router;
