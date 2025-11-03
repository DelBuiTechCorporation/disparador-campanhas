import { Router } from 'express';
import { streamChatwootTags } from '../controllers/chatwootController';

const router = Router();

// GET /api/chatwoot/tags/stream - Stream de tags em tempo real (SSE)
router.get('/tags/stream', streamChatwootTags);

export default router;
