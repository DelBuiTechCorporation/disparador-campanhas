import { Router } from 'express';
import { connectionController } from '../controllers/connectionController';

const router = Router();

router.post('/', connectionController.create);
router.get('/', connectionController.list);
router.get('/:id', connectionController.get);
router.put('/:id', connectionController.update);
router.delete('/:id', connectionController.delete);

export default router;
