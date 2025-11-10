import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';

interface ChatwootTag {
  name: string;
  count: number;
}

interface TagMapping {
  chatwootTag: string;
  categoryId: string;
}

interface ChatwootSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChatwootSyncModal({ isOpen, onClose, onSuccess }: ChatwootSyncModalProps) {
  const [chatwootTags, setChatwootTags] = useState<ChatwootTag[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagEventSource, setTagEventSource] = useState<EventSource | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Carregar categorias quando modal abrir
  React.useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadCategories = async () => {
    try {
      const categoriesData = await apiService.getAllCategories();
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
      setCategories([]);
    }
  };

  const cancelTagLoading = () => {
    if (tagEventSource) {
      tagEventSource.close();
      setTagEventSource(null);
    }
    setIsLoadingTags(false);
    toast.dismiss('tags-toast');
    toast('Carregamento de tags cancelado', { icon: '⛔' });
  };

  const loadChatwootTags = async () => {
    setIsLoadingTags(true);
    let eventSource: EventSource | null = null;

    try {
      toast.loading('Carregando tags do Chatwoot em tempo real...', { id: 'tags-toast' });

      // Usar SSE para streaming de tags
      eventSource = apiService.streamChatwootTags(
        (tags) => {
          // Update callback - tags são recebidas conforme carregam
          setChatwootTags(tags);
          if (tags.length > 0) {
            toast.loading(`${tags.length} tags carregadas...`, { id: 'tags-toast' });
          }
        },
        (error) => {
          // Error callback
          setIsLoadingTags(false);
          if (eventSource) eventSource.close();
          
          if (error.includes('Configure') || error.includes('não configurado')) {
            toast.error('Configure o Chatwoot na página de Integrações primeiro', { duration: 5000, id: 'tags-toast' });
          } else if (error.includes('Conexão perdida')) {
            toast.error('Conexão perdida com o servidor. Tente novamente.', { id: 'tags-toast' });
          } else {
            toast.error(error, { id: 'tags-toast' });
          }
        }
      );

      // Armazenar referência do EventSource
      setTagEventSource(eventSource);

      // Listener para quando o SSE fecha (tags_complete)
      eventSource.addEventListener('tags_complete', () => {
        setIsLoadingTags(false);
        setTagEventSource(null);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        if (chatwootTags.length === 0) {
          toast('Nenhuma tag encontrada no Chatwoot', { icon: 'ℹ️', id: 'tags-toast' });
        } else {
          toast.success(`Tags carregadas com sucesso!`, { id: 'tags-toast' });
        }
      });
      
    } catch (error: any) {
      if (eventSource) eventSource.close();
      setTagEventSource(null);
      console.error('Erro ao iniciar carregamento de tags:', error);
      setIsLoadingTags(false);
      const errorMessage = error.message || 'Erro ao carregar tags do Chatwoot';

      if (errorMessage.includes('Configure') || errorMessage.includes('não configurado')) {
        toast.error('Configure o Chatwoot na página de Integrações primeiro', { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleTagMappingChange = (chatwootTag: string, categoryId: string) => {
    setTagMappings((prev) => {
      const existing = prev.find((m) => m.chatwootTag === chatwootTag);
      if (existing) {
        if (!categoryId) {
          // Remove if no category selected
          return prev.filter((m) => m.chatwootTag !== chatwootTag);
        }
        // Update existing
        return prev.map((m) =>
          m.chatwootTag === chatwootTag ? { ...m, categoryId } : m
        );
      } else if (categoryId) {
        // Add new
        return [...prev, { chatwootTag, categoryId }];
      }
      return prev;
    });
  };

  const handleImport = async () => {
    if (tagMappings.length === 0) {
      toast.error('Selecione pelo menos uma tag para importar');
      return;
    }

    setIsImporting(true);
    try {
      toast.loading('Importando contatos do Chatwoot...', { id: 'import-toast' });
      
      const token = localStorage.getItem('auth_token');
      const selectedTenantId = localStorage.getItem('selected_tenant_id');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      if (selectedTenantId) {
        headers['X-Tenant-Id'] = selectedTenantId;
      }

      const response = await fetch('/api/chatwoot/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tagMappings,
          tenantId: selectedTenantId // Para SUPERADMIN
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Erro ao importar contatos');
      }

      const result = await response.json();
      
      toast.success(
        `Importação concluída! ${result.data.imported} contatos importados, ${result.data.updated} atualizados`,
        { id: 'import-toast', duration: 5000 }
      );
      
      // Limpar cache após importação bem-sucedida
      clearChatwootCache();
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      
      if (error.message.includes('não configurado') || error.message.includes('Configure')) {
        toast.error('Configure o Chatwoot na página de Integrações primeiro', { 
          id: 'import-toast',
          duration: 5000 
        });
      } else {
        toast.error(error.message || 'Erro ao importar contatos', { id: 'import-toast' });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (isLoadingTags) {
      if (!confirm('Carregamento de tags em andamento. Deseja sair?')) {
        return;
      }
      cancelTagLoading();
    }

    if (isImporting) {
      if (!confirm('Importação em andamento. Deseja sair?')) {
        return;
      }
    }

    if (tagEventSource) {
      tagEventSource.close();
      setTagEventSource(null);
    }
    
    // Limpar cache ao fechar o modal
    clearChatwootCache();
    
    setChatwootTags([]);
    setTagMappings([]);
    onClose();
  };

  const clearChatwootCache = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const selectedTenantId = localStorage.getItem('selected_tenant_id');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      if (selectedTenantId) {
        headers['X-Tenant-Id'] = selectedTenantId;
      }

      await fetch('/api/chatwoot/cache', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          tenantId: selectedTenantId // Para SUPERADMIN
        })
      });

      console.log('🗑️ Cache do Chatwoot limpo');
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      // Não exibir erro para o usuário, é um cleanup silencioso
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-100 my-8" role="dialog" aria-labelledby="chatwoot-sync-title">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 id="chatwoot-sync-title" className="text-xl font-bold text-gray-900">
                Sincronizar com Chatwoot
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Importe contatos do Chatwoot por tags
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Load Tags Button */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">Tags do Chatwoot</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {chatwootTags.length > 0
                    ? `${chatwootTags.length} tags encontradas`
                    : 'Clique para carregar as tags'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadChatwootTags}
                  disabled={isLoadingTags}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingTags ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Carregando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {chatwootTags.length > 0 ? 'Atualizar Tags' : 'Carregar Tags'}
                    </>
                  )}
                </button>
                {isLoadingTags && (
                  <button
                    onClick={cancelTagLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Tag Mappings */}
            {chatwootTags.length > 0 && (
              <div className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-700">
                    <div>Tag do Chatwoot</div>
                    <div>Contatos</div>
                    <div>Categoria de Destino</div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {chatwootTags.map((tag) => (
                    <div
                      key={tag.name}
                      className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tag.name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {tag.count} {tag.count === 1 ? 'contato' : 'contatos'}
                        </div>
                        <div>
                          <select
                            value={tagMappings.find((m) => m.chatwootTag === tag.name)?.categoryId || ''}
                            onChange={(e) => handleTagMappingChange(tag.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Não importar</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Mappings Summary */}
            {tagMappings.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 text-sm mb-2">
                  ✓ {tagMappings.length} {tagMappings.length === 1 ? 'tag selecionada' : 'tags selecionadas'}
                </h3>
                <div className="text-xs text-green-700 space-y-1">
                  {tagMappings.map((mapping) => {
                    const tag = chatwootTags.find((t) => t.name === mapping.chatwootTag);
                    const category = categories.find((c) => c.id === mapping.categoryId);
                    return (
                      <div key={mapping.chatwootTag}>
                        • <strong>{mapping.chatwootTag}</strong> ({tag?.count || 0} contatos) → {category?.nome || 'Categoria'}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Instructions */}
            {chatwootTags.length === 0 && !isLoadingTags && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 text-sm mb-2">ℹ️ Como funciona</h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Clique em "Carregar Tags" para buscar as tags do Chatwoot</li>
                  <li>• Associe cada tag do Chatwoot a uma categoria do sistema</li>
                  <li>• Os contatos das conversas com essas tags serão importados</li>
                  <li>• Contatos já existentes serão atualizados</li>
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
            >
              Fechar
            </button>
            <button
              onClick={handleImport}
              disabled={tagMappings.length === 0 || isImporting}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Importar Contatos
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
