import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const AudioNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const variationsCount = props.data.config?.mediaVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} áudio${variationsCount > 1 ? 's' : ''}`;
    }

    const hasMedia = props.data.config?.mediaUrl;
    return hasMedia ? 'Áudio configurado' : 'Selecione um áudio';
  };

  const getPreview = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const mediaVariations = props.data.config?.mediaVariations || [];

    if (hasVariations) {
      // Mostrar grid de variações de áudio
      const audiosWithUrl = mediaVariations.filter((v: any) => v?.url);
      if (audiosWithUrl.length === 0) return null;

      return (
        <div className="grid grid-cols-2 gap-1">
          {audiosWithUrl.slice(0, 4).map((variation: any, index: number) => (
            <div key={index} className="rounded bg-orange-50 border border-orange-200 p-2 flex flex-col items-center justify-center aspect-square">
              <div className="text-2xl mb-1">🎵</div>
              <span className="text-xs text-gray-600 text-center truncate w-full px-1">
                {variation.fileName ? variation.fileName.substring(0, 15) : `Áudio ${index + 1}`}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // Mostrar áudio único
    const mediaUrl = props.data.config?.mediaUrl;
    const fileName = props.data.config?.fileName;
    if (!mediaUrl) return null;

    return (
      <div className="rounded bg-orange-50 border border-orange-200 p-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl">🎵</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {fileName || 'Áudio'}
            </p>
            <audio src={mediaUrl} controls className="w-full mt-1 h-8" style={{ maxHeight: '32px' }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      {...props}
      icon="🎵"
      label="Áudio"
      color="#f59e0b"
      description={getDescription()}
      preview={getPreview()}
      onDelete={props.data.onDelete}
    />
  );
});

AudioNode.displayName = 'AudioNode';
