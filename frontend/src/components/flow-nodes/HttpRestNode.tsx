import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const HttpRestNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const method = props.data.config?.method || 'GET';
    const url = props.data.config?.url;

    if (!url) return 'Configure a requisição';

    return `${method} ${url.length > 30 ? url.substring(0, 30) + '...' : url}`;
  };

  return (
    <BaseNode
      {...props}
      icon="🌐"
      label="HTTP REST"
      color="#f59e0b"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

HttpRestNode.displayName = 'HttpRestNode';
