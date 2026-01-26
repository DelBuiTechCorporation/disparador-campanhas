import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const ImageNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const variationsCount = props.data.config?.mediaVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} imagem${variationsCount > 1 ? 'ns' : ''}`;
    }

    const hasMedia = props.data.config?.mediaUrl;
    return hasMedia ? 'Imagem configurada' : 'Selecione uma imagem';
  };

  const getPreview = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const mediaVariations = props.data.config?.mediaVariations || [];

    if (hasVariations) {
      // Mostrar grid de variações
      const imagesWithUrl = mediaVariations.filter((v: any) => v?.url);
      if (imagesWithUrl.length === 0) return null;

      return (
        <div className="grid grid-cols-2 gap-1">
          {imagesWithUrl.slice(0, 4).map((variation: any, index: number) => (
            <div key={index} className="aspect-square rounded overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={variation.url}
                alt={`Variação ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    // Mostrar imagem única
    const mediaUrl = props.data.config?.mediaUrl;
    if (!mediaUrl) return null;

    return (
      <div className="rounded overflow-hidden border border-gray-200 bg-gray-100">
        <img
          src={mediaUrl}
          alt="Preview"
          className="w-full h-auto object-cover max-h-32"
        />
      </div>
    );
  };

  return (
    <BaseNode
      {...props}
      icon="🖼️"
      label="Imagem"
      color="#60a5fa"
      description={getDescription()}
      preview={getPreview()}
      onDelete={props.data.onDelete}
    />
  );
});

ImageNode.displayName = 'ImageNode';
