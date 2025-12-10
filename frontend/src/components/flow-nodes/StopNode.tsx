import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

export const StopNode = memo((props: NodeProps) => {
  return (
    <div
      className="relative bg-white border-2 rounded-xl shadow-md min-w-[180px] group"
      style={{
        borderColor: '#233e4f',
        borderLeftWidth: '6px',
      }}
    >
      {/* Botão de deletar */}
      {props.data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.data.onDelete();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 z-10"
          title="Deletar node"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Handle de entrada apenas */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      <div className="px-4 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🛑</span>
          <span className="font-semibold text-gray-900">Stop</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Finaliza o fluxo</p>
      </div>

      {/* Sem handle de saída */}
    </div>
  );
});

StopNode.displayName = 'StopNode';
