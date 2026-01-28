import { Router } from 'express';
import { body } from 'express-validator';
import { ContactController } from '../controllers/contactController';
import { checkContactQuota } from '../middleware/quotaMiddleware';

const router = Router();

const contactValidation = [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('telefone').notEmpty().withMessage('Telefone é obrigatório'),
  body('email').optional().isEmail().withMessage('Email deve ter formato válido'),
  body('tags').optional().isArray().withMessage('Tags deve ser um array'),
  body('observacoes').optional().isString(),
  body('categoriaId').optional().isString().withMessage('CategoriaId deve ser uma string')
];

router.get('/', ContactController.getContacts);
router.get('/:id', ContactController.getContactById);
router.post('/', contactValidation, checkContactQuota, ContactController.createContact);
router.put('/:id', contactValidation, ContactController.updateContact);
router.delete('/:id', ContactController.deleteContact);

// Bulk operations
router.post('/bulk/update', ContactController.bulkUpdateContacts);
router.post('/bulk/delete', ContactController.bulkDeleteContacts);
router.post('/bulk/categories', ContactController.bulkUpdateCategories);

export { router as contactRoutes };