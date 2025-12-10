import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

export const DocumentNode = memo((props: NodeProps) => {
  const getDescription = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const variationsCount = props.data.config?.mediaVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} arquivo${variationsCount > 1 ? 's' : ''}`;
    }

    const hasMedia = props.data.config?.mediaUrl;
    const fileName = props.data.config?.fileName;

    if (hasMedia && fileName) {
      return fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
    }

    return 'Selecione um arquivo';
  };

  const getFileIcon = (fileName: string) => {
    if (!fileName) return '📄';

    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📕';
      case 'doc':
      case 'docx':
        return '📘';
      case 'xls':
      case 'xlsx':
        return '📗';
      case 'txt':
        return '📃';
      case 'zip':
      case 'rar':
        return '📦';
      default:
        return '📄';
    }
  };

  const getPreview = () => {
    const hasVariations = props.data.config?.useMediaVariations;
    const mediaVariations = props.data.config?.mediaVariations || [];

    if (hasVariations) {
      // Mostrar grid de variações de documentos
      const docsWithUrl = mediaVariations.filter((v: any) => v?.url);
      if (docsWithUrl.length === 0) return null;

      return (
        <div className="grid grid-cols-2 gap-1">
          {docsWithUrl.slice(0, 4).map((variation: any, index: number) => (
            <div key={index} className="rounded bg-pink-50 border border-pink-200 p-2 flex flex-col items-center justify-center aspect-square">
              <div className="text-2xl mb-1">{getFileIcon(variation.fileName)}</div>
              <span className="text-xs text-gray-600 text-center truncate w-full px-1">
                {variation.fileName ? variation.fileName.substring(0, 12) : `Doc ${index + 1}`}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // Mostrar documento único
    const mediaUrl = props.data.config?.mediaUrl;
    const fileName = props.data.config?.fileName;
    if (!mediaUrl) return null;

    return (
      <div className="rounded bg-pink-50 border border-pink-200 p-3">
        <div className="flex items-center gap-2">
          <div className="text-3xl">{getFileIcon(fileName)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {fileName || 'Documento'}
            </p>
            <p className="text-xs text-gray-500">
              {fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      {...props}
      icon="📄"
      label="Arquivo"
      color="#ec4899"
      description={getDescription()}
      preview={getPreview()}
      onDelete={props.data.onDelete}
    />
  );
});

DocumentNode.displayName = 'DocumentNode';
