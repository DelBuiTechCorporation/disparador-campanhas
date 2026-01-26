import { Router } from 'express';
import { TenantController } from '../controllers/tenantController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas de tenants requerem autenticação
router.use(authMiddleware);

// GET /api/tenants/allowed-providers - Obter provedores permitidos do tenant atual (qualquer usuário)
router.get('/allowed-providers', TenantController.getAllowedProviders);

// GET /api/tenants - Listar todos os tenants (SUPERADMIN only)
router.get('/', TenantController.listTenants);

// POST /api/tenants - Criar novo tenant
router.post('/', TenantController.createTenant);

// GET /api/tenants/:tenantId - Obter detalhes de um tenant
router.get('/:tenantId', TenantController.getTenant);

// PUT /api/tenants/:tenantId - Atualizar tenant
router.put('/:tenantId', TenantController.updateTenant);

// DELETE /api/tenants/:tenantId - Deletar tenant
router.delete('/:tenantId', TenantController.deleteTenant);

export default router;