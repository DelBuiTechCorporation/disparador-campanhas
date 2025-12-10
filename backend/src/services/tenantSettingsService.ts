import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TenantSettingsService {
  async getTenantSettings(tenantId: string) {
    try {
      console.log('📋 TenantSettingsService.getTenantSettings - tenantId:', tenantId, 'type:', typeof tenantId);

      if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
        console.error('❌ TenantID inválido recebido:', tenantId);
        throw new Error(`TenantID inválido: ${tenantId}`);
      }

      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings) {
        console.log('⚠️ TenantSettings não encontrado, criando novo para tenantId:', tenantId);
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            openaiApiKey: null,
            groqApiKey: null,
            customBranding: undefined
          }
        });
      }

      return settings;
    } catch (error) {
      console.error('❌ Error getting tenant settings for tenantId:', tenantId, 'error:', error);
      throw error;
    }
  }

  async updateTenantSettings(tenantId: string, data: {
    openaiApiKey?: string | null;
    groqApiKey?: string | null;
    customBranding?: any;
    chatwootUrl?: string | null;
    chatwootAccountId?: string | null;
    chatwootApiToken?: string | null;
    perfexUrl?: string | null;
    perfexToken?: string | null;
  }) {
    try {
      const settings = await prisma.tenantSettings.upsert({
        where: { tenantId },
        update: {
          openaiApiKey: data.openaiApiKey !== undefined ? data.openaiApiKey : undefined,
          groqApiKey: data.groqApiKey !== undefined ? data.groqApiKey : undefined,
          customBranding: data.customBranding !== undefined ? data.customBranding : undefined,
          chatwootUrl: data.chatwootUrl !== undefined ? data.chatwootUrl : undefined,
          chatwootAccountId: data.chatwootAccountId !== undefined ? data.chatwootAccountId : undefined,
          chatwootApiToken: data.chatwootApiToken !== undefined ? data.chatwootApiToken : undefined,
          perfexUrl: data.perfexUrl !== undefined ? data.perfexUrl : undefined,
          perfexToken: data.perfexToken !== undefined ? data.perfexToken : undefined
        },
        create: {
          tenantId,
          openaiApiKey: data.openaiApiKey || null,
          groqApiKey: data.groqApiKey || null,
          customBranding: data.customBranding || undefined,
          chatwootUrl: data.chatwootUrl || null,
          chatwootAccountId: data.chatwootAccountId || null,
          chatwootApiToken: data.chatwootApiToken || null,
          perfexUrl: data.perfexUrl || null,
          perfexToken: data.perfexToken || null
        }
      });

      return settings;
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      throw error;
    }
  }
}

export const tenantSettingsService = new TenantSettingsService();