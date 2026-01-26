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
  setBusinessHours,
  getBusinessHours,
  checkBusinessHours,
  getPendingMessages,
  updatePendingMessages,
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
router.get('/:id/messages', authMiddleware, getPendingMessages);
router.get('/:id/pending-messages', authMiddleware, getPendingMessages);
router.post('/', authMiddleware, campaignValidation, checkCampaignQuota, createCampaign);
router.put('/:id', authMiddleware, updateCampaign);
router.patch('/:id/messages', authMiddleware, updatePendingMessages);
router.patch('/:id/pending-messages', authMiddleware, updatePendingMessages);
router.delete('/:id', authMiddleware, deleteCampaign);
router.patch('/:id/toggle', authMiddleware, toggleCampaign);

// Business hours routes
router.put('/:id/business-hours', authMiddleware, setBusinessHours);
router.get('/:id/business-hours', authMiddleware, getBusinessHours);
router.get('/:id/business-hours/check', authMiddleware, checkBusinessHours);

export default router;