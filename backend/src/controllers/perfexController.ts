import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { perfexService } from '../services/perfexService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PerfexController {
  async getLeads(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'TenantId não fornecido' });
      }

      console.log('📋 PerfexController.getLeads - tenantId:', tenantId);

      const leads = await perfexService.getLeads(tenantId);

      res.json({
        success: true,
        leads,
        total: leads.length
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar leads do Perfex:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar leads do Perfex CRM'
      });
    }
  }

  async importLeads(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { leadIds, categoryId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'TenantId não fornecido' });
      }

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'IDs dos leads não fornecidos' });
      }

      if (!categoryId) {
        return res.status(400).json({ error: 'Categoria não fornecida' });
      }

      console.log('📋 PerfexController.importLeads - tenantId:', tenantId, 'leads:', leadIds.length);

      const result = await perfexService.importLeads(tenantId, leadIds, categoryId, prisma);

      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error('❌ Erro ao importar leads do Perfex:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao importar leads do Perfex CRM'
      });
    }
  }

  async getLeadStatuses(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'TenantId não fornecido' });
      }

      console.log('📋 PerfexController.getLeadStatuses - tenantId:', tenantId);

      const statuses = await perfexService.getLeadStatuses(tenantId);

      res.json({
        success: true,
        statuses
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar status do Perfex:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar status do Perfex CRM'
      });
    }
  }

  async getLeadSources(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'TenantId não fornecido' });
      }

      console.log('📋 PerfexController.getLeadSources - tenantId:', tenantId);

      const sources = await perfexService.getLeadSources(tenantId);

      res.json({
        success: true,
        sources
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar fontes do Perfex:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar fontes do Perfex CRM'
      });
    }
  }

  async getStaffMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'TenantId não fornecido' });
      }

      console.log('📋 PerfexController.getStaffMembers - tenantId:', tenantId);

      const staff = await perfexService.getStaffMembers(tenantId);

      res.json({
        success: true,
        staff
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar membros da equipe do Perfex:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar membros da equipe do Perfex CRM'
      });
    }
  }
}

export const perfexController = new PerfexController();
