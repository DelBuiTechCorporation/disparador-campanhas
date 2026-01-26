import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient para evitar múltiplas conexões ao banco
// Em desenvolvimento, o hot-reload pode criar múltiplas instâncias,
// então armazenamos no global para reutilizar entre recargas

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
