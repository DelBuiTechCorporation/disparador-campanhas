import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const VideoNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const variationsCount = props.data.config?.mediaVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} vídeo${variationsCount > 1 ? 's' : ''}`;
    }

    const hasMedia = props.data.config?.mediaUrl;
    return hasMedia ? 'Vídeo configurado' : 'Selecione um vídeo';
  };

  const getPreview = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const mediaVariations = props.data.config?.mediaVariations || [];

    if (hasVariations) {
      // Mostrar grid de variações com thumbnail de vídeo
      const videosWithUrl = mediaVariations.filter((v: any) => v?.url);
      if (videosWithUrl.length === 0) return null;

      return (
        <div className="grid grid-cols-2 gap-1">
          {videosWithUrl.slice(0, 4).map((variation: any, index: number) => (
            <div key={index} className="aspect-square rounded overflow-hidden bg-gray-900 border border-gray-200 flex items-center justify-center relative">
              <video
                src={variation.url}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <div className="text-white text-2xl">▶</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Mostrar vídeo único
    const mediaUrl = props.data.config?.mediaUrl;
    if (!mediaUrl) return null;

    return (
      <div className="rounded overflow-hidden border border-gray-200 bg-gray-900 relative">
        <video
          src={mediaUrl}
          className="w-full h-auto object-cover max-h-32"
          muted
          playsInline
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="text-white text-3xl">▶</div>
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      {...props}
      icon="🎬"
      label="Vídeo"
      color="#a78bfa"
      description={getDescription()}
      preview={getPreview()}
      onDelete={props.data.onDelete}
    />
  );
});

VideoNode.displayName = 'VideoNode';
