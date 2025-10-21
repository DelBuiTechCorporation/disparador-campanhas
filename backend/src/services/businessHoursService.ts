import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BusinessHoursConfig {
  mondayEnabled?: boolean;
  mondayStart?: string | null;
  mondayEnd?: string | null;
  mondayLunchStart?: string | null;
  mondayLunchEnd?: string | null;
  
  tuesdayEnabled?: boolean;
  tuesdayStart?: string | null;
  tuesdayEnd?: string | null;
  tuesdayLunchStart?: string | null;
  tuesdayLunchEnd?: string | null;
  
  wednesdayEnabled?: boolean;
  wednesdayStart?: string | null;
  wednesdayEnd?: string | null;
  wednesdayLunchStart?: string | null;
  wednesdayLunchEnd?: string | null;
  
  thursdayEnabled?: boolean;
  thursdayStart?: string | null;
  thursdayEnd?: string | null;
  thursdayLunchStart?: string | null;
  thursdayLunchEnd?: string | null;
  
  fridayEnabled?: boolean;
  fridayStart?: string | null;
  fridayEnd?: string | null;
  fridayLunchStart?: string | null;
  fridayLunchEnd?: string | null;
  
  saturdayEnabled?: boolean;
  saturdayStart?: string | null;
  saturdayEnd?: string | null;
  saturdayLunchStart?: string | null;
  saturdayLunchEnd?: string | null;
  
  sundayEnabled?: boolean;
  sundayStart?: string | null;
  sundayEnd?: string | null;
  sundayLunchStart?: string | null;
  sundayLunchEnd?: string | null;
}

export interface DayConfig {
  enabled: boolean;
  start?: string;
  end?: string;
  lunchStart?: string;
  lunchEnd?: string;
}

export class BusinessHoursService {
  private static readonly DAYS_OF_WEEK = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  /**
   * Cria ou atualiza os horários comerciais de uma campanha
   */
  static async createOrUpdateBusinessHours(
    campaignId: string,
    config: BusinessHoursConfig,
    tenantId?: string
  ) {
    try {
      const businessHours = await prisma.businessHours.upsert({
        where: { campaignId },
        update: {
          ...config,
          updatedAt: new Date()
        },
        create: {
          campaignId,
          tenantId,
          ...config
        }
      });

      return businessHours;
    } catch (error) {
      console.error('Erro ao salvar horários comerciais:', error);
      throw new Error('Erro ao salvar horários comerciais');
    }
  }

  /**
   * Busca os horários comerciais de uma campanha
   */
  static async getBusinessHours(campaignId: string) {
    try {
      return await prisma.businessHours.findUnique({
        where: { campaignId }
      });
    } catch (error) {
      console.error('Erro ao buscar horários comerciais:', error);
      throw new Error('Erro ao buscar horários comerciais');
    }
  }

  /**
   * Verifica se o horário atual está dentro do horário comercial
   */
  static isWithinBusinessHours(config: BusinessHoursConfig, date: Date = new Date()): boolean {
    const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, etc.
    const dayName = this.DAYS_OF_WEEK[dayOfWeek];
    
    const dayConfig = this.getDayConfig(config, dayName);
    
    // Se o dia não está habilitado, não está em horário comercial
    if (!dayConfig.enabled) {
      return false;
    }

    const currentTime = this.formatTime(date);
    
    // Verifica se tem horário de início e fim configurados
    if (!dayConfig.start || !dayConfig.end) {
      return false;
    }

    // Verifica se está dentro do horário geral
    const isWithinGeneralHours = currentTime >= dayConfig.start && currentTime <= dayConfig.end;
    
    if (!isWithinGeneralHours) {
      return false;
    }

    // Se tem horário de almoço configurado, verifica se não está no almoço
    if (dayConfig.lunchStart && dayConfig.lunchEnd) {
      const isLunchTime = currentTime >= dayConfig.lunchStart && currentTime <= dayConfig.lunchEnd;
      return !isLunchTime;
    }

    return true;
  }

  /**
   * Calcula quando será o próximo horário comercial
   * Sempre retorna o início do próximo período de trabalho disponível
   */
  static getNextBusinessHour(config: BusinessHoursConfig, date: Date = new Date()): Date | null {
    const MAX_DAYS_AHEAD = 7; // Procurar até 7 dias à frente
    
    for (let daysAhead = 0; daysAhead <= MAX_DAYS_AHEAD; daysAhead++) {
      const testDate = new Date(date);
      testDate.setDate(testDate.getDate() + daysAhead);
      
      const dayOfWeek = testDate.getDay();
      const dayName = this.DAYS_OF_WEEK[dayOfWeek];
      const dayConfig = this.getDayConfig(config, dayName);
      
      console.log(`🔍 Verificando dia ${dayName} (daysAhead: ${daysAhead}):`, {
        enabled: dayConfig.enabled,
        start: dayConfig.start,
        end: dayConfig.end,
        lunchStart: dayConfig.lunchStart,
        lunchEnd: dayConfig.lunchEnd
      });
      
      // Pular dias desabilitados ou sem configuração de horário
      if (!dayConfig.enabled || !dayConfig.start || !dayConfig.end) {
        console.log(`⏭️ Dia ${dayName} desabilitado ou sem configuração, pulando...`);
        continue;
      }

      // Se é o mesmo dia, verificar situação atual
      if (daysAhead === 0) {
        const currentTime = this.formatTime(date);
        console.log(`📅 Mesmo dia - Hora atual: ${currentTime}, Start: ${dayConfig.start}, End: ${dayConfig.end}`);
        
        // Se já passou do horário de trabalho, tentar próximo dia
        if (currentTime > dayConfig.end) {
          console.log(`⏰ Passou do horário (${currentTime} > ${dayConfig.end}), tentando próximo dia...`);
          continue;
        }
        
        // Se está ANTES do horário de trabalho, retornar início do trabalho
        if (currentTime < dayConfig.start) {
          console.log(`🌅 Antes do horário (${currentTime} < ${dayConfig.start}), retornando início: ${dayConfig.start}`);
          const nextHour = new Date(testDate);
          const [hours, minutes] = dayConfig.start.split(':').map(Number);
          nextHour.setHours(hours, minutes, 0, 0);
          return nextHour;
        }
        
        // Se tem almoço configurado e está NO almoço, retornar fim do almoço
        if (dayConfig.lunchStart && dayConfig.lunchEnd && 
            currentTime >= dayConfig.lunchStart && currentTime <= dayConfig.lunchEnd) {
          console.log(`🍽️ No almoço (${currentTime} entre ${dayConfig.lunchStart}-${dayConfig.lunchEnd}), retornando fim do almoço: ${dayConfig.lunchEnd}`);
          const nextHour = new Date(testDate);
          const [hours, minutes] = dayConfig.lunchEnd.split(':').map(Number);
          nextHour.setHours(hours, minutes, 0, 0);
          return nextHour;
        }
        
        // Se está em horário comercial válido (dentro do trabalho e fora do almoço), retornar agora
        if (this.isWithinBusinessHours(config, date)) {
          console.log(`✅ Em horário comercial, retornando agora`);
          return date;
        }
        
        console.log(`❓ Nenhuma condição atendida para o mesmo dia, continuando...`);
      } else {
        // Para outros dias, retornar início do expediente
        console.log(`📆 Próximo dia útil (${dayName}), retornando início: ${dayConfig.start}`);
        const nextHour = new Date(testDate);
        const [hours, minutes] = dayConfig.start.split(':').map(Number);
        nextHour.setHours(hours, minutes, 0, 0);
        return nextHour;
      }
    }

    console.log(`❌ Não encontrou próximo horário comercial em ${MAX_DAYS_AHEAD} dias`);
    return null; // Não encontrou próximo horário comercial
  }

  /**
   * Extrai configuração de um dia específico
   */
  private static getDayConfig(config: BusinessHoursConfig, dayName: string): DayConfig {
    const enabled = config[`${dayName}Enabled` as keyof BusinessHoursConfig] as boolean || false;
    const start = config[`${dayName}Start` as keyof BusinessHoursConfig] as string || undefined;
    const end = config[`${dayName}End` as keyof BusinessHoursConfig] as string || undefined;
    const lunchStart = config[`${dayName}LunchStart` as keyof BusinessHoursConfig] as string || undefined;
    const lunchEnd = config[`${dayName}LunchEnd` as keyof BusinessHoursConfig] as string || undefined;

    return { enabled, start, end, lunchStart, lunchEnd };
  }

  /**
   * Formata uma data para HH:MM
   */
  private static formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Valida se uma string de tempo está no formato HH:MM
   */
  static isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Valida se um horário de fim é maior que o horário de início
   */
  static isValidTimeRange(start: string, end: string): boolean {
    if (!this.isValidTimeFormat(start) || !this.isValidTimeFormat(end)) {
      return false;
    }
    return start < end;
  }
}