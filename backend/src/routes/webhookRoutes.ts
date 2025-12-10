import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

// Rota pública (sem authMiddleware) pois recebe de provedores externos
router.post('/wa/:connectionId/callback', webhookController.handleCallback);

export default router;
