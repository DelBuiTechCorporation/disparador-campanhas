import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const DelayNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const { value, unit } = props.data.config || {};
    if (!value || !unit) return 'Configure o tempo';

    const labels: Record<string, string> = {
      seconds: 'segundo(s)',
      minutes: 'minuto(s)',
      hours: 'hora(s)',
      days: 'dia(s)',
    };

    return `${value} ${labels[unit] || unit}`;
  };

  return (
    <BaseNode
      {...props}
      icon="⏱️"
      label="Delay"
      color="#ff7a7a"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

DelayNode.displayName = 'DelayNode';
