import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const IntegrationPerfexNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const action = props.data.config?.action;
    const value = props.data.config?.value;

    if (!action) return 'Configure a ação';

    const labels: Record<string, string> = {
      update_status: '📊 Atualizar Status',
      update_source: '🌐 Atualizar Fonte',
      assign_to: '👤 Atribuir Para',
      mark_lost: '❌ Marcar como Perdido',
      mark_junk: '🗑️ Marcar como Lixo',
    };

    const actionLabel = labels[action] || action;
    return value ? `${actionLabel}: ${value}` : actionLabel;
  };

  return (
    <BaseNode
      {...props}
      icon="🔧"
      label="Perfex CRM"
      color="#9333ea"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

IntegrationPerfexNode.displayName = 'IntegrationPerfexNode';
