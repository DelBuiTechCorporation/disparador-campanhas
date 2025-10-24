import { Router } from 'express';
import { getChatwootTags, syncChatwootContacts } from '../controllers/chatwootController';

const router = Router();

// GET /api/chatwoot/tags - Buscar tags do Chatwoot
router.get('/tags', getChatwootTags);

// POST /api/chatwoot/sync - Sincronizar contatos do Chatwoot
router.post('/sync', syncChatwootContacts);

export default router;
