import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const TriggerNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const config = props.data.config;

    if (!config) {
      return 'Clique para configurar';
    }

    const parts = [];

    // Tipo de início
    if (config.scheduleType === 'scheduled') {
      parts.push('📅 Agendado');
    } else {
      parts.push('⚡ Imediato');
    }

    // Número de conexões
    if (config.connections?.length) {
      parts.push(`${config.connections.length} conexão(ões)`);
    } else {
      parts.push('⚠️ Sem conexões');
    }

    // Número de categorias
    if (config.categories?.length) {
      parts.push(`${config.categories.length} categoria(s)`);
    } else {
      parts.push('⚠️ Sem categorias');
    }

    return parts.join(' • ');
  };

  return (
    <BaseNode
      {...props}
      icon="⚡"
      label="Trigger"
      color="#8ad0f3"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

TriggerNode.displayName = 'TriggerNode';
