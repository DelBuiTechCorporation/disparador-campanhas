import { Router } from 'express';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaign,
  getCampaignReport,
  getContactTags,
  getActiveSessions,
  setBusinessHours,
  getBusinessHours,
  checkBusinessHours,
  campaignValidation
} from '../controllers/campaignController';
import { authMiddleware } from '../middleware/auth';
import { checkCampaignQuota } from '../middleware/quotaMiddleware';

const router = Router();

// Campaign CRUD routes
router.get('/', authMiddleware, listCampaigns);
router.get('/tags', authMiddleware, getContactTags);
router.get('/sessions', authMiddleware, getActiveSessions);
router.get('/:id', authMiddleware, getCampaign);
router.get('/:id/report', authMiddleware, getCampaignReport);
router.post('/', authMiddleware, campaignValidation, checkCampaignQuota, createCampaign);
router.put('/:id', authMiddleware, updateCampaign);
router.delete('/:id', authMiddleware, deleteCampaign);
router.patch('/:id/toggle', authMiddleware, toggleCampaign);

// Business hours routes
router.put('/:id/business-hours', authMiddleware, setBusinessHours);
router.get('/:id/business-hours', authMiddleware, getBusinessHours);
router.get('/:id/business-hours/check', authMiddleware, checkBusinessHours);

export default router;