import { Request, Response } from 'express';
import { connectionService } from '../services/connectionService';

export const connectionController = {
  /**
   * POST /api/connections
   * Cria uma nova conexão
   */
  async create(req: Request, res: Response) {
    try {
      const { provider, instanceName, phoneNumber } = req.body;
      const tenantId = (req as any).user?.tenantId;

      if (!provider || !instanceName || !phoneNumber) {
        return res.status(400).json({
          error: 'provider, instanceName e phoneNumber são obrigatórios',
        });
      }

      const connection = await connectionService.createConnection({
        provider,
        instanceName,
        phoneNumber,
        tenantId,
      });

      return res.status(201).json(connection);
    } catch (error: any) {
      console.error('Error creating connection:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /api/connections
   * Lista todas as conexões do tenant
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const connections = await connectionService.listConnections(tenantId);

      return res.json(connections);
    } catch (error: any) {
      console.error('Error listing connections:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /api/connections/:id
   * Busca uma conexão específica
   */
  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const connection = await connectionService.getConnection(id);

      if (!connection) {
        return res.status(404).json({ error: 'Conexão não encontrada' });
      }

      return res.json(connection);
    } catch (error: any) {
      console.error('Error getting connection:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /api/connections/:id
   * Atualiza uma conexão
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, phoneNumber } = req.body;

      const connection = await connectionService.updateConnection(id, {
        status,
        phoneNumber,
      });

      return res.json(connection);
    } catch (error: any) {
      console.error('Error updating connection:', error);
      return res.status(500).json({ error: error.message });
    }
  },

  /**
   * DELETE /api/connections/:id
   * Deleta uma conexão
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await connectionService.deleteConnection(id);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting connection:', error);
      return res.status(500).json({ error: error.message });
    }
  },
};
