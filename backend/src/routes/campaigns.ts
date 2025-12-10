import { Router } from 'express';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaign,
  getCampaignReport,
  downloadCampaignReport,
  getContactTags,
  getActiveSessions,
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
router.get('/:id/report/download', authMiddleware, downloadCampaignReport);
router.post('/', authMiddleware, campaignValidation, checkCampaignQuota, createCampaign);
router.put('/:id', authMiddleware, updateCampaign);
router.delete('/:id', authMiddleware, deleteCampaign);
router.patch('/:id/toggle', authMiddleware, toggleCampaign);

export default router;