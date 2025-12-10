import { Router } from 'express';
import { param, query } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { checkUserQuota } from '../middleware/quotaMiddleware';
import {
  getUsers,
  getAllUsersGlobal,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getAvailableTenants,
  getUserStats,
  usersValidators
} from '../controllers/usersController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get user statistics (for dashboard)
router.get('/stats', getUserStats);

// Get available tenants for user assignment (SUPERADMIN only)
router.get('/tenants', getAvailableTenants);

// Get all users globally (SUPERADMIN only - sem filtro de tenant)
router.get('/global',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('Tamanho da página deve estar entre 1 e 100'),
    query('search').optional().isString().trim(),
    query('role').optional().isIn(['ADMIN', 'USER', 'SUPERADMIN']),
    query('ativo').optional().isBoolean()
  ],
  getAllUsersGlobal
);

// List users with filters and pagination
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('Tamanho da página deve estar entre 1 e 100'),
    query('search').optional().isString().trim(),
    query('role').optional().isIn(['ADMIN', 'USER', 'SUPERADMIN']),
    query('tenantId').optional().isUUID(),
    query('ativo').optional().isBoolean()
  ],
  getUsers
);

// Get specific user
router.get('/:id',
  [
    param('id').isUUID().withMessage('ID deve ser um UUID válido')
  ],
  getUser
);

// Create new user
router.post('/',
  usersValidators.create,
  checkUserQuota,
  createUser
);

// Update user
router.put('/:id',
  [
    param('id').isUUID().withMessage('ID deve ser um UUID válido'),
    ...usersValidators.update
  ],
  updateUser
);

// Delete user
router.delete('/:id',
  [
    param('id').isUUID().withMessage('ID deve ser um UUID válido')
  ],
  deleteUser
);

export default router;