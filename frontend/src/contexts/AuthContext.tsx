import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin?: string | null;
  criadoEm: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE_URL = '/api';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Interceptar requisições para adicionar token
  const apiRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });
  };

  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Erro ao fazer login');
        return false;
      }

      const { token: newToken, user: userData } = data.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth_token', newToken);

      toast.success('Login realizado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error('Erro de conexão. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    toast.success('Logout realizado com sucesso!');
  };

  const checkAuth = async (): Promise<boolean> => {
    console.log('[AUTH] checkAuth chamado, token:', !!token);
    
    if (!token) {
      console.log('[AUTH] Sem token, definindo isLoading como false');
      setIsLoading(false);
      return false;
    }

    try {
      console.log('[AUTH] Verificando token...');
      
      // Adicionar timeout de 10 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[AUTH] Timeout na verificação');
        controller.abort();
      }, 10000);

      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('[AUTH] Resposta não ok:', response.status);
        logout();
        return false;
      }

      const data = await response.json();
      console.log('[AUTH] Token válido, usuário:', data.data.user.email);
      setUser(data.data.user);
      return true;
    } catch (error) {
      console.error('[AUTH] Erro ao verificar autenticação:', error);
      logout();
      return false;
    } finally {
      console.log('[AUTH] Finalizando checkAuth, isLoading = false');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Interceptar respostas 401 da API para fazer logout automático
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Só faz logout se for uma resposta 401 de uma rota da API
      if (response.status === 401 && isAuthenticated && args[0]?.toString().includes('/api/')) {
        console.log('Token expirado ou inválido, fazendo logout...');
        logout();
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isAuthenticated, logout]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
    setUser,
    setToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};