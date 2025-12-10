import { Request, Response } from 'express';
import { interactiveCampaignService } from '../services/interactiveCampaignService';

export const interactiveCampaignController = {
  /**
   * POST /api/interactive-campaigns
   * Cria uma nova campanha interativa
   */
  async create(req: Request, res: Response) {
    try {
      const { connectionId, name, graph } = req.body;
      const tenantId = (req as any).user?.tenantId;

      if (!name || !graph) {
        return res.status(400).json({
          error: 'name e graph são obrigatórios',
        });
      }

      const campaign = await interactiveCampaignService.createCampaign({
        connectionId,
        name,
        graph,
        tenantId,
      });

      return res.status(201).json(campaign);
    } catch (error: any) {
      console.error('Error creating interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /api/interactive-campaigns
   * Lista campanhas interativas
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const connectionId = req.query.connectionId as string | undefined;

      const campaigns = await interactiveCampaignService.listCampaigns(
        tenantId,
        connectionId
      );

      return res.json(campaigns);
    } catch (error: any) {
      console.error('Error listing interactive campaigns:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /api/interactive-campaigns/:id
   * Busca uma campanha específica (com validação de tenant)
   */
  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;
      const campaign = await interactiveCampaignService.getCampaign(id, tenantId);

      if (!campaign) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
      }

      return res.json(campaign);
    } catch (error: any) {
      console.error('Error getting interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /api/interactive-campaigns/:id
   * Atualiza uma campanha (com validação de tenant)
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, status, graph, scheduledDate } = req.body;
      const tenantId = (req as any).user?.tenantId;

      const campaign = await interactiveCampaignService.updateCampaign(id, {
        name,
        status,
        graph,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      }, tenantId);

      return res.json(campaign);
    } catch (error: any) {
      console.error('Error updating interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * DELETE /api/interactive-campaigns/:id
   * Deleta uma campanha (com validação de tenant)
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;
      await interactiveCampaignService.deleteCampaign(id, tenantId);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/interactive-campaigns/:id/publish
   * Publica uma campanha (com validação de tenant)
   */
  async publish(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledDate } = req.body;
      const tenantId = (req as any).user?.tenantId;

      console.log(`Publishing campaign ${id}, scheduledDate: ${scheduledDate}`);

      let scheduledDateTime: Date | undefined;
      if (scheduledDate) {
        scheduledDateTime = new Date(scheduledDate);
        if (isNaN(scheduledDateTime.getTime())) {
          return res.status(400).json({ error: 'Data de agendamento inválida' });
        }
      }

      // Determinar status: STARTED (imediato) ou SCHEDULED (agendado)
      const newStatus = scheduledDateTime ? 'SCHEDULED' : 'STARTED';

      const campaign = await interactiveCampaignService.publishCampaign(
        id,
        scheduledDateTime,
        tenantId,
        newStatus
      );

      // Se não há agendamento, dispara imediatamente
      if (!scheduledDateTime) {
        console.log(`🚀 Triggering immediate dispatch for campaign ${id}`);
        const { interactiveCampaignDispatchService } = await import('../services/interactiveCampaignDispatchService');

        // Dispara em background para não bloquear resposta
        setImmediate(() => {
          interactiveCampaignDispatchService.dispatchCampaign(id).catch(error => {
            console.error(`❌ Error dispatching campaign ${id}:`, error);
          });
        });
      } else {
        console.log(`📅 Campaign ${id} scheduled for ${scheduledDateTime.toISOString()}`);
      }

      return res.json(campaign);
    } catch (error: any) {
      console.error('Error publishing interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/interactive-campaigns/:id/pause
   * Pausa uma campanha (com validação de tenant)
   */
  async pause(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;

      const campaign = await interactiveCampaignService.pauseCampaign(id, tenantId);

      return res.json(campaign);
    } catch (error: any) {
      console.error('Error pausing interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/interactive-campaigns/:id/complete
   * Finaliza uma campanha (com validação de tenant)
   */
  async complete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;

      const campaign = await interactiveCampaignService.completeCampaign(id, tenantId);

      return res.json(campaign);
    } catch (error: any) {
      console.error('Error completing interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/interactive-campaigns/:id/duplicate
   * Duplica uma campanha existente
   */
  async duplicate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;

      const duplicatedCampaign = await interactiveCampaignService.duplicateCampaign(id, tenantId);

      return res.json(duplicatedCampaign);
    } catch (error: any) {
      console.error('Error duplicating interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/interactive-campaigns/:id/simulate
   * Simula execução de uma mensagem no fluxo (com validação de tenant)
   */
  async simulate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { from, text } = req.body;
      const tenantId = (req as any).user?.tenantId;

      if (!from || !text) {
        return res.status(400).json({
          error: 'from e text são obrigatórios',
        });
      }

      const campaign = await interactiveCampaignService.getCampaign(id, tenantId);

      if (!campaign) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
      }

      // TODO: Implementar simulação usando flowEngineService
      // Por enquanto, retornar mock
      const executionTrace = [
        {
          nodeId: 'trigger-1',
          nodeType: 'trigger',
          result: 'matched',
          message: 'Mensagem recebida e trigger ativado',
        },
        {
          nodeId: 'action-1',
          nodeType: 'action',
          result: 'executed',
          message: 'Ação de envio de mensagem executada',
        },
      ];

      return res.json({
        success: true,
        executionTrace,
        message: 'Simulação executada com sucesso',
      });
    } catch (error: any) {
      console.error('Error simulating interactive campaign:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /api/interactive-campaigns/:id/report
   * Obtém relatório detalhado de uma campanha interativa
   */
  async getReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenantId;

      const report = await interactiveCampaignService.getCampaignReport(id, tenantId);

      if (!report) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
      }

      return res.json(report);
    } catch (error: any) {
      console.error('Error getting interactive campaign report:', error);
      return res.status(500).json({ error: error.message });
    }
  },
};
