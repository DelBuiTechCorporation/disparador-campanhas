import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { perfexController } from '../controllers/perfexController';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/perfex/leads - Buscar leads do Perfex CRM
router.get('/leads', (req, res) => perfexController.getLeads(req, res));

// POST /api/perfex/import - Importar leads selecionados
router.post('/import', (req, res) => perfexController.importLeads(req, res));

// GET /api/perfex/statuses - Buscar status de leads
router.get('/statuses', (req, res) => perfexController.getLeadStatuses(req, res));

// GET /api/perfex/sources - Buscar fontes de leads
router.get('/sources', (req, res) => perfexController.getLeadSources(req, res));

// GET /api/perfex/staff - Buscar membros da equipe
router.get('/staff', (req, res) => perfexController.getStaffMembers(req, res));

export default router;
