/**
 * Flow Engine Service
 * Motor de execução de fluxos interativos
 */

import { perfexIntegrationService } from './perfexIntegrationService';
import { chatwootIntegrationService } from './chatwootIntegrationService';

interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay' | 'stop' | 'integration_perfex' | 'integration_chatwoot';
  data: any;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface MessageContext {
  from: string;
  to: string;
  content?: string;
  type: string;
  timestamp: Date;
  contactTags?: string[];
  tenantId?: string;
  phonenumber?: string;
  contactId?: string;
}

interface ExecutionResult {
  success: boolean;
  trace: Array<{
    nodeId: string;
    nodeType: string;
    result: string;
    message: string;
    data?: any;
  }>;
  actions: Array<{
    type: string;
    data: any;
  }>;
}

export const flowEngineService = {
  /**
   * Executa um fluxo com base em uma mensagem recebida
   */
  async executeFlow(
    graph: FlowGraph,
    context: MessageContext
  ): Promise<ExecutionResult> {
    const trace: ExecutionResult['trace'] = [];
    const actions: ExecutionResult['actions'] = [];

    // Encontrar nó trigger
    const triggerNode = graph.nodes.find((n) => n.type === 'trigger');

    if (!triggerNode) {
      return {
        success: false,
        trace: [
          {
            nodeId: 'none',
            nodeType: 'error',
            result: 'no_trigger',
            message: 'Nenhum trigger encontrado no fluxo',
          },
        ],
        actions: [],
      };
    }

    // Avaliar trigger
    const triggerMatch = this.evaluateTrigger(triggerNode, context);

    trace.push({
      nodeId: triggerNode.id,
      nodeType: 'trigger',
      result: triggerMatch ? 'matched' : 'not_matched',
      message: triggerMatch
        ? 'Trigger ativado'
        : 'Trigger não corresponde à mensagem',
    });

    if (!triggerMatch) {
      return { success: false, trace, actions };
    }

    // Seguir o fluxo a partir do trigger
    let currentNodeId = triggerNode.id;
    const visited = new Set<string>();
    const maxIterations = 50; // prevenir loops infinitos
    let iterations = 0;

    while (currentNodeId && iterations < maxIterations) {
      iterations++;

      if (visited.has(currentNodeId)) {
        trace.push({
          nodeId: currentNodeId,
          nodeType: 'error',
          result: 'loop_detected',
          message: 'Loop detectado no fluxo',
        });
        break;
      }

      visited.add(currentNodeId);

      // Encontrar próximo nó
      const nextEdge = graph.edges.find((e) => e.source === currentNodeId);

      if (!nextEdge) {
        // Fim do fluxo
        break;
      }

      const nextNode = graph.nodes.find((n) => n.id === nextEdge.target);

      if (!nextNode) {
        trace.push({
          nodeId: currentNodeId,
          nodeType: 'error',
          result: 'missing_node',
          message: `Nó ${nextEdge.target} não encontrado`,
        });
        break;
      }

      // Processar nó
      const nodeResult = await this.processNode(nextNode, context);

      trace.push({
        nodeId: nextNode.id,
        nodeType: nextNode.type,
        result: nodeResult.result,
        message: nodeResult.message,
        data: nodeResult.data,
      });

      // Se for action, adicionar à lista de ações
      if (nextNode.type === 'action' && nodeResult.action) {
        actions.push(nodeResult.action);
      }

      // Se for stop ou condição falhou, parar
      if (nextNode.type === 'stop' || nodeResult.result === 'false') {
        break;
      }

      currentNodeId = nextNode.id;
    }

    return {
      success: true,
      trace,
      actions,
    };
  },

  /**
   * Avalia se o trigger corresponde à mensagem
   */
  evaluateTrigger(node: FlowNode, context: MessageContext): boolean {
    const { data } = node;

    // Verificar palavras-chave (se configurado)
    if (data.keywords && data.keywords.length > 0) {
      const content = context.content?.toLowerCase() || '';
      const matchesKeyword = data.keywords.some((keyword: string) =>
        content.includes(keyword.toLowerCase())
      );

      if (!matchesKeyword) {
        return false;
      }
    }

    // TODO: Adicionar filtros por tags de contato, horário, etc

    return true;
  },

  /**
   * Processa um nó do fluxo
   */
  async processNode(
    node: FlowNode,
    context: MessageContext
  ): Promise<{
    result: string;
    message: string;
    data?: any;
    action?: any;
  }> {
    switch (node.type) {
      case 'condition':
        return this.processCondition(node, context);

      case 'action':
        return this.processAction(node, context);

      case 'delay':
        return {
          result: 'delayed',
          message: `Delay de ${node.data.duration || 0}ms`,
        };

      case 'stop':
        return {
          result: 'stopped',
          message: 'Fluxo finalizado',
        };

      case 'integration_perfex':
        return await this.processIntegrationPerfex(node, context);

      case 'integration_chatwoot':
        return await this.processIntegrationChatwoot(node, context);

      default:
        return {
          result: 'unknown',
          message: `Tipo de nó desconhecido: ${node.type}`,
        };
    }
  },

  /**
   * Processa condição (if/contains/regex)
   */
  processCondition(
    node: FlowNode,
    context: MessageContext
  ): {
    result: string;
    message: string;
  } {
    const { data } = node;
    const content = context.content || '';

    let conditionMet = false;

    switch (data.conditionType) {
      case 'contains':
        conditionMet = content
          .toLowerCase()
          .includes(data.value?.toLowerCase() || '');
        break;

      case 'regex':
        try {
          const regex = new RegExp(data.value || '');
          conditionMet = regex.test(content);
        } catch (e) {
          return {
            result: 'error',
            message: 'Regex inválido',
          };
        }
        break;

      case 'equals':
        conditionMet = content.toLowerCase() === data.value?.toLowerCase();
        break;

      default:
        conditionMet = false;
    }

    return {
      result: conditionMet ? 'true' : 'false',
      message: conditionMet ? 'Condição atendida' : 'Condição não atendida',
    };
  },

  /**
   * Processa ação (send message, add tag, webhook, etc)
   */
  processAction(
    node: FlowNode,
    context: MessageContext
  ): {
    result: string;
    message: string;
    action: any;
  } {
    const { data } = node;

    switch (data.actionType) {
      case 'sendMessage':
        return {
          result: 'queued',
          message: 'Mensagem enfileirada para envio',
          action: {
            type: 'sendMessage',
            data: {
              to: context.from,
              content: data.messageContent || '',
              buttons: data.buttons || [],
            },
          },
        };

      case 'addTag':
        return {
          result: 'queued',
          message: 'Tag adicionada ao contato',
          action: {
            type: 'addTag',
            data: {
              contactPhone: context.from,
              tag: data.tag || '',
            },
          },
        };

      case 'createChatwootTicket':
        return {
          result: 'queued',
          message: 'Ticket Chatwoot criado',
          action: {
            type: 'createChatwootTicket',
            data: {
              contactPhone: context.from,
              message: context.content,
            },
          },
        };

      case 'httpWebhook':
        return {
          result: 'queued',
          message: 'Webhook HTTP enfileirado',
          action: {
            type: 'httpWebhook',
            data: {
              url: data.webhookUrl || '',
              method: data.method || 'POST',
              payload: {
                from: context.from,
                message: context.content,
                timestamp: context.timestamp,
              },
            },
          },
        };

      default:
        return {
          result: 'unknown',
          message: `Tipo de ação desconhecido: ${data.actionType}`,
          action: null,
        };
    }
  },

  /**
   * Processa integração com Perfex CRM
   */
  async processIntegrationPerfex(
    node: FlowNode,
    context: MessageContext
  ): Promise<{
    result: string;
    message: string;
    data?: any;
  }> {
    const { data } = node;

    if (!context.tenantId) {
      return {
        result: 'error',
        message: 'TenantId não fornecido no contexto',
      };
    }

    if (!context.phonenumber) {
      return {
        result: 'error',
        message: 'Telefone não fornecido no contexto',
      };
    }

    try {
      // Acessar config dentro de data
      const config = data.config || data;
      const action = config.action || 'update_status';
      const value = config.value || '';

      const success = await perfexIntegrationService.executeIntegration(
        context.tenantId,
        context.phonenumber,
        action,
        value,
        context.contactId // Passar o ID do contato para buscar o perfexLeadId
      );

      return {
        result: success ? 'success' : 'failed',
        message: success
          ? `Perfex: ${action} executado com sucesso`
          : 'Perfex: Falha ao executar integração',
        data: { action, value },
      };
    } catch (error: any) {
      console.error('Erro ao processar integração Perfex:', error);
      return {
        result: 'error',
        message: `Perfex: ${error.message}`,
      };
    }
  },

  /**
   * Processa integração com Chatwoot
   */
  async processIntegrationChatwoot(
    node: FlowNode,
    context: MessageContext
  ): Promise<{
    result: string;
    message: string;
    data?: any;
  }> {
    const { data } = node;

    if (!context.tenantId) {
      return {
        result: 'error',
        message: 'TenantId não fornecido no contexto',
      };
    }

    if (!context.phonenumber) {
      return {
        result: 'error',
        message: 'Telefone não fornecido no contexto',
      };
    }

    try {
      // Acessar config dentro de data
      const config = data.config || data;
      const action = config.action || 'add';
      const tags = config.tags || [];

      if (!Array.isArray(tags) || tags.length === 0) {
        return {
          result: 'error',
          message: 'Chatwoot: Nenhuma tag fornecida',
        };
      }

      const success = await chatwootIntegrationService.executeIntegration(
        context.tenantId,
        context.phonenumber,
        action,
        tags
      );

      return {
        result: success ? 'success' : 'failed',
        message: success
          ? `Chatwoot: Tags ${action === 'add' ? 'adicionadas' : 'removidas'} com sucesso`
          : 'Chatwoot: Falha ao executar integração',
        data: { action, tags },
      };
    } catch (error: any) {
      console.error('Erro ao processar integração Chatwoot:', error);
      return {
        result: 'error',
        message: `Chatwoot: ${error.message}`,
      };
    }
  },
};
