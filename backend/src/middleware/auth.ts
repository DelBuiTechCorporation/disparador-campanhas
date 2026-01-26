import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    nome: string;
    role: string;
    tenantId?: string;
  };
  tenantId?: string; // For easier access
  tenant?: {
    id: string;
    slug: string;
    name: string;
    active: boolean;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Tentar obter token de header Authorization ou query string (para SSE)
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // Tentar obter de query string para SSE (EventSource)
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET não configurado!');
      res.status(500).json({
        success: false,
        message: 'Erro de configuração do servidor'
      });
      return;
    }
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Verificar se o usuário ainda existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.ativo) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
      return;
    }

    // Adicionar dados do usuário à request
    req.user = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      tenantId: decoded.tenantId
    };

    // Para SuperAdmin, permitir override do tenantId via header X-Tenant-Id
    let effectiveTenantId = decoded.tenantId;
    if (user.role === 'SUPERADMIN') {
      const headerTenantId = req.header('X-Tenant-Id');
      if (headerTenantId) {
        effectiveTenantId = headerTenantId;
      }
    }

    // Adicionar tenantId diretamente para fácil acesso
    req.tenantId = effectiveTenantId;

    // Se não é SUPERADMIN ou tem tenantId definido, buscar dados do tenant
    if (effectiveTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: {
          id: effectiveTenantId,
          active: true
        },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true
        }
      });

      if (!tenant) {
        res.status(401).json({
          success: false,
          message: 'Tenant não encontrado ou inativo'
        });
        return;
      }

      req.tenant = tenant;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
      return;
    }

    console.error('Erro no middleware de autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const adminMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Acesso negado. Permissão de administrador necessária.'
    });
    return;
  }

  next();
};