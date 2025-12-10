import { Response } from 'express';
import { validationResult } from 'express-validator';
import { ContactService } from '../services/contactService';
import { ApiError } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class ContactController {
  static async getContacts(req: AuthenticatedRequest, res: Response) {
    try {
      const { search, tag, page = '1', pageSize = '30' } = req.query;

      // Sempre usar tenantId do token
      const tenantId = req.tenantId;

      const result = await ContactService.getContacts(
        search as string,
        parseInt(page as string),
        parseInt(pageSize as string),
        tenantId,
        tag as string
      );

      res.json(result);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao buscar contatos',
        details: error instanceof Error ? error.message : error
      };
      res.status(500).json(apiError);
    }
  }

  static async getContactById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const contact = await ContactService.getContactById(id, tenantId);
      res.json(contact);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Contato não encontrado',
        details: error instanceof Error ? error.message : error
      };
      res.status(404).json(apiError);
    }
  }

  static async createContact(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const apiError: ApiError = {
          error: 'Dados inválidos',
          details: errors.array()
        };
        return res.status(400).json(apiError);
      }

      // Usar tenantId do token
      const tenantId = req.tenantId;
      const contactData = { ...req.body, tenantId };

      const contact = await ContactService.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao criar contato',
        details: error instanceof Error ? error.message : error
      };
      res.status(400).json(apiError);
    }
  }

  static async updateContact(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const apiError: ApiError = {
          error: 'Dados inválidos',
          details: errors.array()
        };
        return res.status(400).json(apiError);
      }

      const { id } = req.params;
      const tenantId = req.tenantId;
      const contact = await ContactService.updateContact(id, req.body, tenantId);
      res.json(contact);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao atualizar contato',
        details: error instanceof Error ? error.message : error
      };
      res.status(400).json(apiError);
    }
  }

  static async deleteContact(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      await ContactService.deleteContact(id, tenantId);
      res.status(204).send();
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao excluir contato',
        details: error instanceof Error ? error.message : error
      };
      res.status(400).json(apiError);
    }
  }

  static async bulkUpdateContacts(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const apiError: ApiError = {
          error: 'Dados inválidos',
          details: errors.array()
        };
        return res.status(400).json(apiError);
      }

      const { contactIds, updates } = req.body;
      const tenantId = req.tenantId;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        const apiError: ApiError = {
          error: 'IDs de contatos são obrigatórios',
          details: 'Forneça um array de IDs'
        };
        return res.status(400).json(apiError);
      }

      const result = await ContactService.bulkUpdateContacts(contactIds, updates, tenantId);
      res.json(result);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao atualizar contatos em massa',
        details: error instanceof Error ? error.message : error
      };
      res.status(400).json(apiError);
    }
  }

  static async bulkDeleteContacts(req: AuthenticatedRequest, res: Response) {
    try {
      const { contactIds } = req.body;
      const tenantId = req.tenantId;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        const apiError: ApiError = {
          error: 'IDs de contatos são obrigatórios',
          details: 'Forneça um array de IDs'
        };
        return res.status(400).json(apiError);
      }

      const result = await ContactService.bulkDeleteContacts(contactIds, tenantId);
      res.json(result);
    } catch (error) {
      const apiError: ApiError = {
        error: 'Erro ao excluir contatos em massa',
        details: error instanceof Error ? error.message : error
      };
      res.status(400).json(apiError);
    }
  }
}