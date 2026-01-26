import { PrismaClient } from '@prisma/client';
import { websocketService } from './websocketService';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

// Tipos de triggers disponíveis
export enum TriggerType {
  CONTACT_CREATED = 'CONTACT_CREATED',
  CONTACT_UPDATED = 'CONTACT_UPDATED',
  CAMPAIGN_COMPLETED = 'CAMPAIGN_COMPLETED',
  MESSAGE_DELIVERED = 'MESSAGE_DELIVERED',
  MESSAGE_READ = 'MESSAGE_READ',
  MESSAGE_FAILED = 'MESSAGE_FAILED',
  TIME_BASED = 'TIME_BASED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  TAG_ADDED = 'TAG_ADDED',
  TAG_REMOVED = 'TAG_REMOVED'
}

// Tipos de condições
export enum ConditionType {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IN_LIST = 'IN_LIST',
  NOT_IN_LIST = 'NOT_IN_LIST',
  HAS_TAG = 'HAS_TAG',
  NOT_HAS_TAG = 'NOT_HAS_TAG',
  DATE_RANGE = 'DATE_RANGE'
}

// Tipos de ações
export enum ActionType {
  SEND_MESSAGE = 'SEND_MESSAGE',
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  CREATE_CAMPAIGN = 'CREATE_CAMPAIGN',
  SEND_EMAIL = 'SEND_EMAIL',
  WEBHOOK_CALL = 'WEBHOOK_CALL',
  UPDATE_CONTACT = 'UPDATE_CONTACT',
  CREATE_NOTIFICATION = 'CREATE_NOTIFICATION',
  DELAY = 'DELAY',
  CONDITIONAL_BRANCH = 'CONDITIONAL_BRANCH'
}

interface AutomationFlow {
  id?: string;
  name: string;
  description: string;
  tenantId: string;
  active: boolean;
  trigger: FlowTrigger;
  conditions?: FlowCondition[];
  actions: FlowAction[];
  createdBy: string;
}

interface FlowTrigger {
  type: TriggerType;
  config: any; // Configuração específica do trigger
}

interface FlowCondition {
  field: string;
  type: ConditionType;
  value: any;
  operator?: 'AND' | 'OR';
}

interface FlowAction {
  type: ActionType;
  config: any;
  order: number;
  delay?: number; // Delay em minutos antes da execução
}

interface ExecutionContext {
  flowId: string;
  tenantId: string;
  triggerData: any;
  contactId?: string;
  campaignId?: string;
  variables: { [key: string]: any };
}

export class AutomationService {
  private static instance: AutomationService;
  private flowExecutions: Map<string, any> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {
    // Inicialização assíncrona movida para não travar o servidor
    // this.initializeActiveFlows();
  }

  public static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  // Inicializar fluxos ativos
  private async initializeActiveFlows(): Promise<void> {
    try {
      console.log('🤖 Inicializando fluxos de automação...');

      const activeFlows = await prisma.automationFlow.findMany({
        where: { active: true },
        include: {
          tenant: { select: { name: true, slug: true } },
          creator: { select: { nome: true } }
        }
      });

      for (const flow of activeFlows) {
        await this.registerFlow(flow);
      }

      console.log(`✅ ${activeFlows.length} fluxos de automação inicializados`);
    } catch (error) {
      console.error('❌ Erro ao inicializar fluxos:', error);
    }
  }

  // Criar novo fluxo de automação
  public async createFlow(flowData: AutomationFlow): Promise<any> {
    try {
      console.log(`🔧 Criando fluxo de automação: ${flowData.name}`);

      // Validar fluxo
      const validation = await this.validateFlow(flowData);
      if (!validation.valid) {
        throw new Error(`Fluxo inválido: ${validation.errors.join(', ')}`);
      }

      const flow = await prisma.automationFlow.create({
        data: {
          name: flowData.name,
          description: flowData.description,
          tenantId: flowData.tenantId,
          active: flowData.active,
          trigger: flowData.trigger as any,
          conditions: flowData.conditions as any,
          actions: flowData.actions as any,
          createdBy: flowData.createdBy
        }
      });

      // Registrar fluxo se estiver ativo
      if (flow.active) {
        await this.registerFlow(flow);
      }

      // Notificar criação
      await websocketService.notifyTenant(flowData.tenantId, {
        title: 'Fluxo de Automação Criado',
        message: `O fluxo "${flowData.name}" foi criado com sucesso.`,
        type: 'SUCCESS',
        data: { flowId: flow.id, flowName: flow.name }
      });

      console.log(`✅ Fluxo criado: ${flow.name} (${flow.id})`);
      return flow;

    } catch (error) {
      console.error('❌ Erro ao criar fluxo:', error);
      throw error;
    }
  }

  // Atualizar fluxo existente
  public async updateFlow(flowId: string, tenantId: string, updateData: Partial<AutomationFlow>): Promise<any> {
    try {
      const flow = await prisma.automationFlow.update({
        where: { id: flowId, tenantId },
        data: updateData as any
      });

      // Re-registrar fluxo
      await this.unregisterFlow(flowId);
      if (flow.active) {
        await this.registerFlow(flow);
      }

      await websocketService.notifyTenant(tenantId, {
        title: 'Fluxo Atualizado',
        message: `O fluxo "${flow.name}" foi atualizado.`,
        type: 'INFO',
        data: { flowId: flow.id, flowName: flow.name }
      });

      return flow;
    } catch (error) {
      console.error('❌ Erro ao atualizar fluxo:', error);
      throw error;
    }
  }

  // Executar trigger do fluxo
  public async executeTrigger(triggerType: TriggerType, data: any): Promise<void> {
    try {
      // Buscar fluxos que respondem a este trigger
      const matchingFlows = await prisma.automationFlow.findMany({
        where: {
          active: true,
          trigger: {
            path: ['type'],
            equals: triggerType
          }
        }
      });

      console.log(`🔥 Trigger ${triggerType} executado - ${matchingFlows.length} fluxos encontrados`);

      // Executar cada fluxo em paralelo
      const executions = matchingFlows.map(flow => this.executeFlow(flow, data));
      await Promise.allSettled(executions);

    } catch (error) {
      console.error('❌ Erro ao executar trigger:', error);
    }
  }

  // Executar fluxo específico
  private async executeFlow(flow: any, triggerData: any): Promise<void> {
    try {
      const executionId = `${flow.id}_${Date.now()}`;

      console.log(`⚙️ Executando fluxo: ${flow.name} (${executionId})`);

      const context: ExecutionContext = {
        flowId: flow.id,
        tenantId: flow.tenantId,
        triggerData,
        variables: { ...triggerData }
      };

      // Verificar condições se existirem
      if (flow.conditions && flow.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(flow.conditions, context);
        if (!conditionsMet) {
          console.log(`❌ Condições não atendidas para fluxo ${flow.name}`);
          return;
        }
      }

      // Executar ações sequencialmente
      await this.executeActions(flow.actions, context);

      // Registrar execução bem-sucedida
      await this.logExecution(executionId, flow.id, 'SUCCESS', context);

      console.log(`✅ Fluxo executado com sucesso: ${flow.name}`);

    } catch (error) {
      console.error(`❌ Erro ao executar fluxo ${flow.name}:`, error);
      await this.logExecution(`${flow.id}_${Date.now()}`, flow.id, 'FAILED', null, error);
    }
  }

  // Avaliar condições do fluxo
  private async evaluateConditions(conditions: FlowCondition[], context: ExecutionContext): Promise<boolean> {
    let result = true;
    let currentOperator: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = await this.evaluateCondition(condition, context);

      if (currentOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentOperator = condition.operator || 'AND';
    }

    return result;
  }

  // Avaliar condição individual
  private async evaluateCondition(condition: FlowCondition, context: ExecutionContext): Promise<boolean> {
    const fieldValue = this.getFieldValue(condition.field, context);
    const conditionValue = condition.value;

    switch (condition.type) {
      case ConditionType.EQUALS:
        return fieldValue === conditionValue;
      case ConditionType.NOT_EQUALS:
        return fieldValue !== conditionValue;
      case ConditionType.CONTAINS:
        return String(fieldValue).includes(String(conditionValue));
      case ConditionType.NOT_CONTAINS:
        return !String(fieldValue).includes(String(conditionValue));
      case ConditionType.GREATER_THAN:
        return Number(fieldValue) > Number(conditionValue);
      case ConditionType.LESS_THAN:
        return Number(fieldValue) < Number(conditionValue);
      case ConditionType.IN_LIST:
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case ConditionType.NOT_IN_LIST:
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case ConditionType.HAS_TAG:
        return await this.checkContactHasTag(context.contactId, conditionValue);
      case ConditionType.NOT_HAS_TAG:
        return !(await this.checkContactHasTag(context.contactId, conditionValue));
      default:
        return false;
    }
  }

  // Executar ações do fluxo
  private async executeActions(actions: FlowAction[], context: ExecutionContext): Promise<void> {
    // Ordenar ações por ordem
    const sortedActions = actions.sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      // Aplicar delay se configurado
      if (action.delay && action.delay > 0) {
        console.log(`⏳ Aguardando ${action.delay} minutos antes da próxima ação...`);
        await new Promise(resolve => setTimeout(resolve, (action.delay || 0) * 60 * 1000));
      }

      await this.executeAction(action, context);
    }
  }

  // Executar ação específica
  private async executeAction(action: FlowAction, context: ExecutionContext): Promise<void> {
    try {
      console.log(`🎯 Executando ação: ${action.type}`);

      switch (action.type) {
        case ActionType.SEND_MESSAGE:
          await this.executeSendMessageAction(action.config, context);
          break;
        case ActionType.ADD_TAG:
          await this.executeAddTagAction(action.config, context);
          break;
        case ActionType.REMOVE_TAG:
          await this.executeRemoveTagAction(action.config, context);
          break;
        case ActionType.CREATE_CAMPAIGN:
          await this.executeCreateCampaignAction(action.config, context);
          break;
        case ActionType.UPDATE_CONTACT:
          await this.executeUpdateContactAction(action.config, context);
          break;
        case ActionType.CREATE_NOTIFICATION:
          await this.executeCreateNotificationAction(action.config, context);
          break;
        case ActionType.WEBHOOK_CALL:
          await this.executeWebhookCallAction(action.config, context);
          break;
        default:
          console.log(`⚠️ Tipo de ação não implementado: ${action.type}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao executar ação ${action.type}:`, error);
      throw error;
    }
  }

  // Implementações específicas das ações
  private async executeSendMessageAction(config: any, context: ExecutionContext): Promise<void> {
    // Implementar envio de mensagem individual
    console.log('📤 Enviando mensagem automática:', config);
  }

  private async executeAddTagAction(config: any, context: ExecutionContext): Promise<void> {
    if (context.contactId) {
      await prisma.contact.update({
        where: { id: context.contactId },
        data: {
          tags: {
            push: config.tag
          }
        }
      });
      console.log(`🏷️ Tag adicionada: ${config.tag}`);
    }
  }

  private async executeRemoveTagAction(config: any, context: ExecutionContext): Promise<void> {
    if (context.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: context.contactId }
      });

      if (contact) {
        const newTags = contact.tags.filter(tag => tag !== config.tag);
        await prisma.contact.update({
          where: { id: context.contactId },
          data: { tags: newTags }
        });
        console.log(`🏷️ Tag removida: ${config.tag}`);
      }
    }
  }

  private async executeCreateNotificationAction(config: any, context: ExecutionContext): Promise<void> {
    await websocketService.notifyTenant(context.tenantId, {
      title: config.title || 'Automação Executada',
      message: config.message || 'Uma automação foi executada com sucesso.',
      type: config.type || 'INFO',
      data: { flowId: context.flowId, ...config.data }
    });
  }

  private async executeCreateCampaignAction(config: any, context: ExecutionContext): Promise<void> {
    try {
      // Criar nova campanha baseada na configuração
      await prisma.campaign.create({
        data: {
          nome: config.name,
          targetTags: config.targets?.join(',') || '',
          messageContent: config.message,
          messageType: 'text',
          randomDelay: 30,
          startImmediately: config.startImmediately || false,
          scheduledFor: config.scheduledFor ? new Date(config.scheduledFor) : null,
          tenantId: context.tenantId,
          createdBy: 'automation',
          createdByName: 'Sistema de Automação'
        }
      });

      console.log('🎯 Campanha criada automaticamente:', config.name);
    } catch (error) {
      console.error('❌ Erro ao criar campanha:', error);
      throw error;
    }
  }

  private async executeUpdateContactAction(config: any, context: ExecutionContext): Promise<void> {
    if (context.contactId && config.fields) {
      try {
        await prisma.contact.update({
          where: { id: context.contactId },
          data: config.fields
        });
        console.log('📝 Contato atualizado:', context.contactId);
      } catch (error) {
        console.error('❌ Erro ao atualizar contato:', error);
        throw error;
      }
    }
  }

  private async executeWebhookCallAction(config: any, context: ExecutionContext): Promise<void> {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          ...context.triggerData,
          flowId: context.flowId,
          tenantId: context.tenantId
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook call failed: ${response.statusText}`);
      }

      console.log('🔗 Webhook executado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao executar webhook:', error);
      throw error;
    }
  }

  // Métodos auxiliares
  private async registerFlow(flow: any): Promise<void> {
    console.log(`📝 Registrando fluxo: ${flow.name}`);

    // Para triggers baseados em tempo, configurar cron job
    if (flow.trigger.type === TriggerType.TIME_BASED) {
      const cronExpression = flow.trigger.config.cronExpression;
      if (cronExpression) {
        const job = cron.schedule(cronExpression, async () => {
          await this.executeFlow(flow, { timestamp: new Date() });
        });

        this.scheduledJobs.set(flow.id, job);
        console.log(`⏰ Job agendado para fluxo ${flow.name}: ${cronExpression}`);
      }
    }
  }

  private async unregisterFlow(flowId: string): Promise<void> {
    const job = this.scheduledJobs.get(flowId);
    if (job) {
      job.destroy();
      this.scheduledJobs.delete(flowId);
      console.log(`⏰ Job removido para fluxo: ${flowId}`);
    }
  }

  private getFieldValue(field: string, context: ExecutionContext): any {
    const parts = field.split('.');
    let value = context.variables;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private async checkContactHasTag(contactId: string | undefined, tag: string): Promise<boolean> {
    if (!contactId) return false;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tags: true }
    });

    return contact?.tags.includes(tag) || false;
  }

  private async validateFlow(flow: AutomationFlow): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!flow.name || flow.name.trim().length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    }

    if (!flow.trigger || !flow.trigger.type) {
      errors.push('Trigger é obrigatório');
    }

    if (!flow.actions || flow.actions.length === 0) {
      errors.push('Pelo menos uma ação é obrigatória');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async logExecution(executionId: string, flowId: string, status: string, context: ExecutionContext | null, error?: any): Promise<void> {
    try {
      await prisma.automationExecution.create({
        data: {
          id: executionId,
          flowId,
          status,
          executedAt: new Date(),
          context: context as any,
          error: error ? String(error) : null
        }
      });
    } catch (logError) {
      console.error('❌ Erro ao registrar execução:', logError);
    }
  }

  // Métodos públicos para gerenciamento
  public async getFlows(tenantId: string, filters?: any): Promise<any[]> {
    return await prisma.automationFlow.findMany({
      where: { tenantId, ...filters },
      include: {
        creator: { select: { nome: true } },
        executions: {
          take: 5,
          orderBy: { executedAt: 'desc' }
        }
      }
    });
  }

  public async getFlowExecutions(flowId: string, tenantId: string): Promise<any[]> {
    const flow = await prisma.automationFlow.findFirst({
      where: { id: flowId, tenantId }
    });

    if (!flow) {
      throw new Error('Fluxo não encontrado');
    }

    return await prisma.automationExecution.findMany({
      where: { flowId },
      orderBy: { executedAt: 'desc' },
      take: 50
    });
  }

  public async deleteFlow(flowId: string, tenantId: string): Promise<boolean> {
    await this.unregisterFlow(flowId);

    await prisma.automationFlow.delete({
      where: { id: flowId, tenantId }
    });

    return true;
  }

  // Método para executar fluxo manualmente (teste)
  public async testFlow(flowId: string, tenantId: string, testData: any): Promise<any> {
    const flow = await prisma.automationFlow.findFirst({
      where: { id: flowId, tenantId }
    });

    if (!flow) {
      throw new Error('Fluxo não encontrado');
    }

    await this.executeFlow(flow, testData);
    return { success: true, message: 'Fluxo executado em modo de teste' };
  }
}

export const automationService = AutomationService.getInstance();