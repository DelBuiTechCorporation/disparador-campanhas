import { useState, useEffect } from 'react';
import { useCategories } from '../hooks/useCategories';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContactIds: string[];
  onSuccess: () => void;
}

export function BulkEditModal({ isOpen, onClose, selectedContactIds, onSuccess }: BulkEditModalProps) {
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [action, setAction] = useState<'update' | 'delete'>('update');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { categories } = useCategories();

  useEffect(() => {
    if (isOpen) {
      setCategoriaId('');
      setAction('update');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedContactIds.length === 0) {
      toast.error('Nenhum contato selecionado');
      return;
    }

    if (action === 'update' && !categoriaId) {
      toast.error('Selecione uma categoria');
      return;
    }

    setIsSubmitting(true);

    try {
      if (action === 'update') {
        await api.post('/contatos/bulk/update', {
          contactIds: selectedContactIds,
          updates: {
            categoriaId: categoriaId || null,
          },
        });
        toast.success(`${selectedContactIds.length} contato(s) atualizado(s) com sucesso!`);
      } else {
        const confirmDelete = window.confirm(
          `Tem certeza que deseja excluir ${selectedContactIds.length} contato(s)? Esta ação não pode ser desfeita.`
        );
        if (!confirmDelete) {
          setIsSubmitting(false);
          return;
        }

        await api.post('/contatos/bulk/delete', {
          contactIds: selectedContactIds,
        });
        toast.success(`${selectedContactIds.length} contato(s) excluído(s) com sucesso!`);
      }
      onSuccess();
    } catch (error: any) {
      console.error('Erro na operação em massa:', error);
      toast.error(error.response?.data?.error || 'Erro ao processar operação em massa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--astra-dark-blue)' }}>
          Edição em Massa
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          {selectedContactIds.length} contato(s) selecionado(s)
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ação
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'update' | 'delete')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="update">Atualizar Categoria</option>
              <option value="delete">Excluir Contatos</option>
            </select>
          </div>

          {action === 'update' && (
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-2">
                Categoria *
              </label>
              <select
                id="categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={action === 'update'}
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {action === 'delete' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800">
                ⚠️ Atenção: Esta ação irá excluir permanentemente {selectedContactIds.length} contato(s) e não poderá ser desfeita.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 disabled:opacity-50 ${
                action === 'delete'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {isSubmitting ? 'Processando...' : action === 'delete' ? 'Excluir' : 'Atualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
