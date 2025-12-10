import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const IntegrationChatwootNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const action = props.data.config?.action;
    const tags = props.data.config?.tags || [];

    if (!action || tags.length === 0) return 'Configure as tags';

    const actionLabel = action === 'add' ? '➕ Adicionar' : '➖ Remover';
    const tagsText = tags.length > 2
      ? `${tags.slice(0, 2).join(', ')} +${tags.length - 2}`
      : tags.join(', ');

    return `${actionLabel}: ${tagsText}`;
  };

  return (
    <BaseNode
      {...props}
      icon="💬"
      label="Chatwoot"
      color="#1f93ff"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

IntegrationChatwootNode.displayName = 'IntegrationChatwootNode';
