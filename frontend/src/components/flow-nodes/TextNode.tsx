import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const TextNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const hasVariations = props.data.config?.useTextVariations;
    const variationsCount = props.data.config?.textVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} variação${variationsCount > 1 ? 'ões' : ''}`;
    }

    const content = props.data.config?.content;
    if (content) {
      return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }

    return 'Configure a mensagem';
  };

  return (
    <BaseNode
      {...props}
      icon="📝"
      label="Texto"
      color="#3ddc97"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

TextNode.displayName = 'TextNode';
