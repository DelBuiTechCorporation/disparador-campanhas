import { useState, useEffect, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface FlowPreviewModalProps {
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

export function FlowPreviewModal({ nodes, edges, onClose }: FlowPreviewModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Iniciar o fluxo com o trigger
    startFlow();
  }, []);

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const startFlow = () => {
    // Encontrar nó trigger
    const triggerNode = nodes.find(n => n.data?.nodeType === 'trigger');
    if (!triggerNode) {
      addMessage('bot', '⚠️ Nenhum nó Trigger encontrado no fluxo.');
      return;
    }

    // Encontrar próximo nó após o trigger
    const nextEdge = edges.find(e => e.source === triggerNode.id);
    if (!nextEdge) {
      addMessage('bot', '⚠️ Trigger não está conectado a nenhum nó.');
      return;
    }

    const nextNode = nodes.find(n => n.id === nextEdge.target);
    if (nextNode) {
      processNode(nextNode);
    }
  };

  const processNode = (node: Node) => {
    setCurrentNodeId(node.id);

    if (node.data?.nodeType === 'action') {
      // Enviar mensagem do bot
      const content = node.data.config?.content || node.data.config?.message || 'Mensagem não configurada';
      addMessage('bot', content);

      // Verificar próximo nó
      const nextEdge = edges.find(e => e.source === node.id);
      if (nextEdge) {
        const nextNode = nodes.find(n => n.id === nextEdge.target);
        if (nextNode?.data?.nodeType === 'condition') {
          // Aguardar resposta do usuário para condição
          return;
        } else if (nextNode) {
          // Continuar automaticamente para próximo nó
          setTimeout(() => processNode(nextNode), 500);
        }
      } else {
        // Fim do fluxo
        setTimeout(() => {
          addMessage('bot', '✅ Fim do fluxo.');
        }, 500);
      }
    } else if (node.data?.nodeType === 'condition') {
      // Aguardar resposta do usuário
      return;
    }
  };

  const addMessage = (type: 'bot' | 'user', content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || isProcessing) return;

    setIsProcessing(true);
    const input = userInput.trim();
    addMessage('user', input);
    setUserInput('');

    // Processar resposta
    setTimeout(() => {
      processUserResponse(input);
      setIsProcessing(false);
    }, 300);
  };

  const processUserResponse = (input: string) => {
    if (!currentNodeId) {
      addMessage('bot', '⚠️ Nenhum nó ativo.');
      return;
    }

    // Encontrar próximas edges do nó atual
    const nextEdges = edges.filter(e => e.source === currentNodeId);

    if (nextEdges.length === 0) {
      addMessage('bot', '✅ Fim do fluxo.');
      return;
    }

    // Se tem condição
    const currentNode = nodes.find(n => n.id === currentNodeId);
    const isConditionNode = currentNode?.data?.nodeType === 'condition';

    if (isConditionNode) {
      const config = currentNode.data.config;
      const operator = config?.operator || 'contains';
      const value = config?.value?.toLowerCase() || '';
      const normalizedInput = input.toLowerCase();

      let conditionMet = false;

      switch (operator) {
        case 'equals':
        case '==':
          conditionMet = normalizedInput === value;
          break;
        case 'contains':
          conditionMet = normalizedInput.includes(value);
          break;
        case 'startsWith':
          conditionMet = normalizedInput.startsWith(value);
          break;
        case 'endsWith':
          conditionMet = normalizedInput.endsWith(value);
          break;
        case 'notEquals':
        case '!=':
          conditionMet = normalizedInput !== value;
          break;
        default:
          conditionMet = normalizedInput.includes(value);
      }

      // Encontrar edge correspondente
      const targetEdge = nextEdges.find(e => {
        const label = e.label?.toString().toLowerCase();
        return conditionMet
          ? (label === 'true' || label === 'sim' || label === 'yes' || label === 'verdadeiro')
          : (label === 'false' || label === 'não' || label === 'no' || label === 'falso');
      });

      if (targetEdge) {
        const nextNode = nodes.find(n => n.id === targetEdge.target);
        if (nextNode) {
          setTimeout(() => processNode(nextNode), 500);
          return;
        }
      }

      // Fallback: usar primeira edge
      if (nextEdges.length > 0) {
        const nextNode = nodes.find(n => n.id === nextEdges[0].target);
        if (nextNode) {
          setTimeout(() => processNode(nextNode), 500);
          return;
        }
      }
    } else {
      // Não é condição, seguir para próximo nó
      if (nextEdges.length > 0) {
        const nextNode = nodes.find(n => n.id === nextEdges[0].target);
        if (nextNode) {
          setTimeout(() => processNode(nextNode), 500);
          return;
        }
      }
    }

    addMessage('bot', '✅ Fim do fluxo.');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setUserInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <aside className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-40">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Preview do Bot</h2>
            <p className="text-xs text-purple-100">Teste o fluxo antes de publicar</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p className="text-sm">Iniciando conversa...</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-purple-100' : 'text-gray-400'}`}>
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-50">
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
            title="Adicionar emoji"
          >
            <span className="text-xl">😀</span>
          </button>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 text-sm"
          />
          <button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || isProcessing}
            className="px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Pressione Enter para enviar
        </p>
      </div>
    </aside>
  );
}
