export interface Contact {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  observacoes?: string | null;
  categoriaId?: string | null;
  categoria?: Category | null;
  perfexLeadId?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ContactInput {
  nome: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  categoriaId?: string;
}

export interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Category {
  id: string;
  nome: string;
  cor: string;
  descricao?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CategoryInput {
  nome: string;
  cor: string;
  descricao?: string;
}

export interface CategoriesResponse {
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: any;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: string[];
  message?: string;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface UserInput {
  nome: string;
  email: string;
  senha?: string;
  role: string;
  ativo?: boolean;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}