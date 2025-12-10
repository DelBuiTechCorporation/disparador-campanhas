import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const ActionNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const type = props.data.config?.actionType;
    if (!type) return 'Selecione uma ação';

    const labels: Record<string, string> = {
      text: '📝 Texto',
      image: '🖼️ Imagem',
      video: '🎬 Vídeo',
      audio: '🎵 Áudio',
      document: '📄 Arquivo',
      openai: '🤖 OpenAI',
      groq: '⚡ Groq AI',
    };

    return labels[type] || type;
  };

  return (
    <BaseNode
      {...props}
      icon="🚀"
      label="Ação"
      color="#3ddc97"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

ActionNode.displayName = 'ActionNode';
