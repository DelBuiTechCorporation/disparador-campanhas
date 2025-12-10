import { Router } from 'express';
import { interactiveCampaignController } from '../controllers/interactiveCampaignController';
import { checkCampaignQuota } from '../middleware/quotaMiddleware';

const router = Router();

router.post('/', checkCampaignQuota, interactiveCampaignController.create);
router.get('/', interactiveCampaignController.list);
router.get('/:id', interactiveCampaignController.get);
router.get('/:id/report', interactiveCampaignController.getReport);
router.put('/:id', interactiveCampaignController.update);
router.delete('/:id', interactiveCampaignController.delete);
router.post('/:id/publish', interactiveCampaignController.publish);
router.post('/:id/pause', interactiveCampaignController.pause);
router.post('/:id/complete', interactiveCampaignController.complete);
router.post('/:id/duplicate', interactiveCampaignController.duplicate);
router.post('/:id/simulate', interactiveCampaignController.simulate);

export default router;
