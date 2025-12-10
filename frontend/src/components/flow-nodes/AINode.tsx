import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const AINode = memo((props: NodeProps) => {
  const getDescription = () => {
    const provider = props.data.config?.aiProvider;
    const prompt = props.data.config?.prompt;

    if (provider && prompt) {
      const providerLabel = provider === 'openai' ? 'OpenAI' : 'Groq';
      return `${providerLabel}: ${prompt.substring(0, 20)}${prompt.length > 20 ? '...' : ''}`;
    }

    if (provider) {
      return provider === 'openai' ? '🤖 OpenAI' : '⚡ Groq';
    }

    return 'Configure a IA';
  };

  return (
    <BaseNode
      {...props}
      icon="🤖"
      label="IA"
      color="#8b5cf6"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

AINode.displayName = 'AINode';
