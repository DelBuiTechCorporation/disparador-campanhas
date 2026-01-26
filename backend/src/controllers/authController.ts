import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const JWT_SECRET: string = process.env.JWT_SECRET || 'astra-online-secure-key-2024';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';

interface UserResponse {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin?: Date | null;
  criadoEm: Date;
}

const generateToken = (userId: string, email: string, role: string, tenantId?: string): string => {
  const payload = { userId, email, role, tenantId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

const sanitizeUser = (user: any): UserResponse => {
  const { senha, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const authValidators = {
  login: [
    body('email')
      .isEmail()
      .withMessage('E-mail inválido')
      .normalizeEmail(),
    body('senha')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter pelo menos 6 caracteres')
  ],
  register: [
    body('nome')
      .isLength({ min: 2 })
      .withMessage('Nome deve ter pelo menos 2 caracteres')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('E-mail inválido')
      .normalizeEmail(),
    body('senha')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter pelo menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'),
    body('role')
      .optional()
      .isIn(['ADMIN', 'USER'])
      .withMessage('Role deve ser ADMIN ou USER')
  ]
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    const { email, senha } = req.body;

    // Buscar usuário por email com informações do tenant
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            active: true
          }
        }
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
      return;
    }

    if (!user.ativo) {
      res.status(401).json({
        success: false,
        message: 'Usuário inativo. Entre em contato com o administrador.'
      });
      return;
    }

    // Verificar se o tenant está ativo (SUPERADMIN não tem tenant)
    if (user.tenant && !user.tenant.active) {
      res.status(401).json({
        success: false,
        message: 'Tenant inativo. Entre em contato com o suporte.'
      });
      return;
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(senha, user.senha);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
      return;
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() }
    });

    // Gerar token com tenantId (SUPERADMIN tem tenantId undefined)
    const token = generateToken(user.id, user.email, user.role, user.tenantId || undefined);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token,
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    const { nome, email, senha, role = 'USER' } = req.body;

    // Para usuários não-SUPERADMIN, é obrigatório ter tenantId
    if (!req.user || (req.user.role !== 'SUPERADMIN' && !req.user.tenantId)) {
      res.status(401).json({
        success: false,
        message: 'Acesso negado. Contexto de tenant necessário.'
      });
      return;
    }

    // Verificar se o email já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'E-mail já está em uso'
      });
      return;
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 12);

    // Determinar tenantId baseado no usuário criador
    let tenantId: string | null = null;

    if (req.user.role === 'SUPERADMIN') {
      // SUPERADMIN pode especificar tenant ou criar usuário sem tenant (outro SUPERADMIN)
      tenantId = req.body.tenantId || null;
    } else {
      // Usuários normais só podem criar usuários no seu próprio tenant
      tenantId = req.user.tenantId || null;
    }

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        role,
        tenantId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            active: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        tenant: user.tenant
      }
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const verifyToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};