import { useState, useEffect } from 'react';

interface Settings {
  id: string;
  wahaHost: string;
  wahaApiKey: string;
  logoUrl?: string;
  companyName?: string;
  faviconUrl?: string;
  pageTitle?: string;
  iconUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

// Cache global das configurações (compartilhado entre todas as instâncias do hook)
let cachedSettings: Settings | null = null;
let cachedError: string | null = null;
let loadingPromise: Promise<void> | null = null;

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(cachedSettings);
  const [loading, setLoading] = useState(!cachedSettings);
  const [error, setError] = useState<string | null>(cachedError);

  const loadSettings = async (forceRefresh = false) => {
    try {
      // Se já existe um cache e não é force refresh, usar o cache
      if (cachedSettings && !forceRefresh) {
        setSettings(cachedSettings);
        setLoading(false);
        return;
      }

      // Se já está carregando, aguardar a promise existente
      if (loadingPromise && !forceRefresh) {
        await loadingPromise;
        setSettings(cachedSettings);
        setLoading(false);
        return;
      }

      setLoading(true);
      const token = localStorage.getItem('auth_token');

      // Só carrega se houver token (usuário autenticado)
      if (!token) {
        setLoading(false);
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      (headers as Record<string, string>).Authorization = `Bearer ${token}`;

      // Criar promise de loading para outras instâncias aguardarem
      loadingPromise = (async () => {
        const response = await fetch('/api/settings', { headers });
        if (response.ok) {
          const data = await response.json();
          cachedSettings = data;
          cachedError = null;
          setSettings(data);
          setError(null);
        } else {
          const errorMsg = 'Erro ao carregar configurações';
          cachedError = errorMsg;
          setError(errorMsg);
        }
      })();

      await loadingPromise;
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      const errorMsg = 'Erro ao carregar configurações';
      cachedError = errorMsg;
      setError(errorMsg);
    } finally {
      setLoading(false);
      loadingPromise = null;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: () => loadSettings(true) // Force refresh quando chamado manualmente
  };
}