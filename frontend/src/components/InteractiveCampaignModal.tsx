import { useState, useEffect } from 'react';
import { Portal } from './Portal';

interface InteractiveCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  title?: string;
}

export function InteractiveCampaignModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  title = 'Nova Campanha Interativa',
}: InteractiveCampaignModalProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    onSave(name);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-card max-w-md w-full p-6 z-10">
            <h2 className="text-xl font-semibold text-ui-text mb-4">{title}</h2>

            <form onSubmit={handleSubmit}>
              {/* Nome */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ui-text mb-2">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Fluxo de Boas-vindas"
                  className="w-full px-4 py-2 border border-ui-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  required
                  autoFocus
                />
                <p className="mt-2 text-xs text-ui-sub">
                  💡 Você configurará as conexões WhatsApp e categorias no nó Trigger após criar a campanha.
                </p>
              </div>

              {/* Ações */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-ui-sub hover:text-ui-text transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-primary text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Portal>
  );
}
