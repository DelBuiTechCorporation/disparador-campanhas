import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface BusinessHoursConfig {
  mondayEnabled?: boolean;
  mondayStart?: string;
  mondayEnd?: string;
  mondayLunchStart?: string;
  mondayLunchEnd?: string;
  
  tuesdayEnabled?: boolean;
  tuesdayStart?: string;
  tuesdayEnd?: string;
  tuesdayLunchStart?: string;
  tuesdayLunchEnd?: string;
  
  wednesdayEnabled?: boolean;
  wednesdayStart?: string;
  wednesdayEnd?: string;
  wednesdayLunchStart?: string;
  wednesdayLunchEnd?: string;
  
  thursdayEnabled?: boolean;
  thursdayStart?: string;
  thursdayEnd?: string;
  thursdayLunchStart?: string;
  thursdayLunchEnd?: string;
  
  fridayEnabled?: boolean;
  fridayStart?: string;
  fridayEnd?: string;
  fridayLunchStart?: string;
  fridayLunchEnd?: string;
  
  saturdayEnabled?: boolean;
  saturdayStart?: string;
  saturdayEnd?: string;
  saturdayLunchStart?: string;
  saturdayLunchEnd?: string;
  
  sundayEnabled?: boolean;
  sundayStart?: string;
  sundayEnd?: string;
  sundayLunchStart?: string;
  sundayLunchEnd?: string;
}

interface DayConfigProps {
  day: string;
  dayLabel: string;
  config: BusinessHoursConfig;
  onChange: (day: string, field: string, value: boolean | string) => void;
}

const DayConfig = ({ day, dayLabel, config, onChange }: DayConfigProps) => {
  const enabled = config[`${day}Enabled` as keyof BusinessHoursConfig] as boolean;
  const start = config[`${day}Start` as keyof BusinessHoursConfig] as string;
  const end = config[`${day}End` as keyof BusinessHoursConfig] as string;
  const lunchStart = config[`${day}LunchStart` as keyof BusinessHoursConfig] as string;
  const lunchEnd = config[`${day}LunchEnd` as keyof BusinessHoursConfig] as string;

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(day, 'Enabled', e.target.checked)}
            className="mr-2"
          />
          <span className="font-medium text-gray-900">{dayLabel}</span>
        </label>
      </div>

      {enabled && (
        <div className="space-y-3">
          {/* Horário de trabalho */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Início
              </label>
              <input
                type="time"
                value={start || '09:00'}
                onChange={(e) => onChange(day, 'Start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fim
              </label>
              <input
                type="time"
                value={end || '18:00'}
                onChange={(e) => onChange(day, 'End', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Horário de almoço (opcional) */}
          <div className="border-t pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervalo de Almoço (opcional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Início do almoço
                </label>
                <input
                  type="time"
                  value={lunchStart || ''}
                  onChange={(e) => onChange(day, 'LunchStart', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Fim do almoço
                </label>
                <input
                  type="time"
                  value={lunchEnd || ''}
                  onChange={(e) => onChange(day, 'LunchEnd', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BusinessHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string; // optional: when creating new campaign, no campaignId
  campaignName?: string;
  // callback used when modal is used during creation to return config to parent instead of saving to API
  onSaveLocal?: (config: BusinessHoursConfig) => void;
}

export function BusinessHoursModal({ isOpen, onClose, campaignId, campaignName, onSaveLocal }: BusinessHoursModalProps) {
  const [config, setConfig] = useState<BusinessHoursConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && campaignId) {
      loadBusinessHours();
    }
  }, [isOpen, campaignId]);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(url, { ...options, headers });
  };

  const loadBusinessHours = async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/campaigns/${campaignId}/business-hours`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data || {});
      }
    } catch (error) {
      console.error('Erro ao carregar horários comerciais:', error);
      toast.error('Erro ao carregar horários comerciais');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (day: string, field: string, value: boolean | string) => {
    const key = `${day}${field}` as keyof BusinessHoursConfig;
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const validateConfig = (): boolean => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      const enabled = config[`${day}Enabled` as keyof BusinessHoursConfig];
      
      if (enabled) {
        const start = config[`${day}Start` as keyof BusinessHoursConfig] as string;
        const end = config[`${day}End` as keyof BusinessHoursConfig] as string;
        const lunchStart = config[`${day}LunchStart` as keyof BusinessHoursConfig] as string;
        const lunchEnd = config[`${day}LunchEnd` as keyof BusinessHoursConfig] as string;

        // Validar horários obrigatórios
        if (!start || !end) {
          toast.error(`Por favor, defina horário de início e fim para ${day}`);
          return false;
        }

        // Validar se fim é maior que início
        if (start >= end) {
          toast.error(`Horário de fim deve ser maior que horário de início para ${day}`);
          return false;
        }

        // Validar horário de almoço se ambos estiverem preenchidos
        if ((lunchStart && !lunchEnd) || (!lunchStart && lunchEnd)) {
          toast.error(`Para ${day}, defina tanto início quanto fim do almoço, ou deixe ambos vazios`);
          return false;
        }

        if (lunchStart && lunchEnd) {
          if (lunchStart >= lunchEnd) {
            toast.error(`Horário de fim do almoço deve ser maior que início do almoço para ${day}`);
            return false;
          }

          // Validar se almoço está dentro do horário de trabalho
          if (lunchStart < start || lunchEnd > end) {
            toast.error(`Horário de almoço deve estar dentro do horário de trabalho para ${day}`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateConfig()) {
      return;
    }

    setSaving(true);
    try {
      // If onSaveLocal is provided and no campaignId, use local callback
      if (onSaveLocal && !campaignId) {
        onSaveLocal(config);
        toast.success('Horários comerciais aplicados (localmente)');
        onClose();
        return;
      }

      const response = await authenticatedFetch(`/api/campaigns/${campaignId}/business-hours`, {
        method: 'PUT',
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast.success('Horários comerciais salvos com sucesso!');
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar horários');
      }
    } catch (error) {
      console.error('Erro ao salvar horários comerciais:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar horários comerciais');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSetup = (type: 'commercial' | 'extended') => {
    const baseConfig: BusinessHoursConfig = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    // Configuração comercial padrão
    if (type === 'commercial') {
      days.forEach(day => {
        baseConfig[`${day}Enabled` as keyof BusinessHoursConfig] = true;
        baseConfig[`${day}Start` as keyof BusinessHoursConfig] = '09:00';
        baseConfig[`${day}End` as keyof BusinessHoursConfig] = '18:00';
        baseConfig[`${day}LunchStart` as keyof BusinessHoursConfig] = '12:00';
        baseConfig[`${day}LunchEnd` as keyof BusinessHoursConfig] = '13:00';
      });
    } else if (type === 'extended') {
      // Segunda a sexta: 8h às 18h
      days.forEach(day => {
        baseConfig[`${day}Enabled` as keyof BusinessHoursConfig] = true;
        baseConfig[`${day}Start` as keyof BusinessHoursConfig] = '08:00';
        baseConfig[`${day}End` as keyof BusinessHoursConfig] = '18:00';
        baseConfig[`${day}LunchStart` as keyof BusinessHoursConfig] = '12:00';
        baseConfig[`${day}LunchEnd` as keyof BusinessHoursConfig] = '13:00';
      });
      
      // Sábado: 8h às 12h
      baseConfig.saturdayEnabled = true;
      baseConfig.saturdayStart = '08:00';
      baseConfig.saturdayEnd = '12:00';
    }

    setConfig(baseConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Horários Comerciais
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Campanha: {campaignName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Configurações rápidas */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Configurações Rápidas
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleQuickSetup('commercial')}
                    className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    Comercial (9h-18h, Seg-Sex)
                  </button>
                  <button
                    onClick={() => handleQuickSetup('extended')}
                    className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                  >
                    Estendido (8h-18h + Sáb 8h-12h)
                  </button>
                </div>
              </div>

              {/* Configuração por dia */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Configuração Detalhada
                </h3>
                
                <DayConfig
                  day="monday"
                  dayLabel="Segunda-feira"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="tuesday"
                  dayLabel="Terça-feira"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="wednesday"
                  dayLabel="Quarta-feira"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="thursday"
                  dayLabel="Quinta-feira"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="friday"
                  dayLabel="Sexta-feira"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="saturday"
                  dayLabel="Sábado"
                  config={config}
                  onChange={handleConfigChange}
                />
                <DayConfig
                  day="sunday"
                  dayLabel="Domingo"
                  config={config}
                  onChange={handleConfigChange}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}