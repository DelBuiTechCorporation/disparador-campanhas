import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';

interface EditMessagesModalProps {
  isOpen: boolean;
  campaignId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Message {
  id: string;
  contactId: string;
  contactPhone: string;
  contactName: string;
  status: string;
  sentAt?: string;
  errorMessage?: string;
  criadoEm: string;
}

interface CampaignMessages {
  messages: Message[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  campaign: {
    id: string;
    nome: string;
    status: string;
    messageType: string;
    messageContent: any;
  };
}

export function EditCampaignMessagesModal({ isOpen, campaignId, onClose, onSuccess }: EditMessagesModalProps) {
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState<CampaignMessages | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [messageContent, setMessageContent] = useState<any>(null);
  const [messageType, setMessageType] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    if (isOpen && campaignId) {
      fetchMessages();
    }
  }, [isOpen, campaignId, currentPage, statusFilter]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const responseData = await api.get(`/campaigns/${campaignId}/pending-messages`, {
        params: {
          page: currentPage,
          limit: 10,
          status: statusFilter
        }
      });

      console.log('📦 API Response:', responseData);

      if (!responseData || !responseData.campaign) {
        console.error('❌ Invalid response structure:', responseData);
        toast.error('Erro: estrutura de resposta inválida');
        return;
      }

      setData(responseData);
      setMessageContent(responseData.campaign?.messageContent);
      setMessageType(responseData.campaign?.messageType);
    } catch (error: any) {
      console.error('❌ Erro ao carregar mensagens:', error);
      toast.error(error.message || 'Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMessages = async () => {
    if (!messageContent) {
      toast.error('Conteúdo da mensagem é obrigatório');
      return;
    }

    try {
      setUpdating(true);
      await api.patch(`/campaigns/${campaignId}/pending-messages`, {
        messageContent,
        messageType
      });

      toast.success('Mensagens atualizadas com sucesso!');
      onSuccess();
      fetchMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar mensagens');
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  const statusColors: { [key: string]: string } = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SENT: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Editar Mensagens da Campanha</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
            >
              ✕
            </button>
          </div>
          {data && (
            <p className="text-blue-100 text-sm mt-1">
              {data.campaign.nome} • Status: <span className="font-semibold">{data.campaign.status}</span>
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {loading && !data ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Campaign Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Status:</span>
                    <span className="ml-2 text-gray-900">{data.campaign.status}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Tipo de Mensagem:</span>
                    <span className="ml-2 text-gray-900">{data.campaign.messageType}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Total de Mensagens:</span>
                    <span className="ml-2 text-gray-900">{data.pagination.total}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Pendentes:</span>
                    <span className="ml-2 text-yellow-700 font-semibold">{data.pagination.total}</span>
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {['PENDING', 'PROCESSING', 'SENT', 'FAILED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Messages List */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Contato</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Telefone</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.messages.map((message) => (
                        <tr key={message.id} className="border-b border-gray-200 hover:bg-gray-100">
                          <td className="px-4 py-3 text-gray-900">{message.contactName}</td>
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs">{message.contactPhone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[message.status]}`}>
                              {message.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {new Date(message.criadoEm).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.messages.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    Nenhuma mensagem encontrada com o filtro selecionado
                  </div>
                )}
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50"
                  >
                    ← Anterior
                  </button>
                  <span className="px-4 py-2 text-gray-700 font-semibold">
                    Página {currentPage} de {data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(data.pagination.totalPages, currentPage + 1))}
                    disabled={currentPage === data.pagination.totalPages}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50"
                  >
                    Próximo →
                  </button>
                </div>
              )}

              {/* Message Content Editor */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Editar Conteúdo da Mensagem
                </label>

                {messageType === 'text' && (
                  <textarea
                    value={typeof messageContent?.text === 'string' ? messageContent.text : ''}
                    onChange={(e) => setMessageContent({ ...messageContent, text: e.target.value })}
                    placeholder="Digite a mensagem... Use {{nome}}, {{email}}, {{telefone}} para variáveis dinâmicas"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-vertical"
                    rows={4}
                  />
                )}

                {messageType === 'image' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={typeof messageContent?.url === 'string' ? messageContent.url : ''}
                      onChange={(e) => setMessageContent({ ...messageContent, url: e.target.value })}
                      placeholder="URL da imagem"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <input
                      type="text"
                      value={typeof messageContent?.caption === 'string' ? messageContent.caption : ''}
                      onChange={(e) => setMessageContent({ ...messageContent, caption: e.target.value })}
                      placeholder="Legenda (opcional)"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                )}

                {messageType === 'sequence' && (
                  <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="font-semibold mb-2">ℹ️ Sequência de mensagens</p>
                    <p>Para editar sequências, use o editor visual na criação da campanha</p>
                  </div>
                )}

                {['openai', 'groq'].includes(messageType) && (
                  <textarea
                    value={typeof messageContent?.prompt === 'string' ? messageContent.prompt : ''}
                    onChange={(e) => setMessageContent({ ...messageContent, prompt: e.target.value })}
                    placeholder="Prompt para IA..."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-vertical"
                    rows={4}
                  />
                )}

                <p className="text-xs text-gray-500 mt-2">
                  ✨ As próximas mensagens a serem enviadas usarão o novo conteúdo
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition"
          >
            Cancelar
          </button>
          {data && ['PENDING', 'RUNNING', 'PAUSED'].includes(data.campaign.status) && (
            <button
              onClick={handleUpdateMessages}
              disabled={updating || !messageContent}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Atualizando...
                </>
              ) : (
                '✓ Atualizar Mensagens'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
