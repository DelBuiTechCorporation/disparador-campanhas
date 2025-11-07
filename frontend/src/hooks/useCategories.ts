import { useState, useEffect, useCallback } from 'react';
import { Category, CategoriesResponse } from '../types';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface UseCategoriesParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCategories(params: UseCategoriesParams = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Se não há parâmetros de paginação, buscar todas as categorias
      if (!params.page && !params.pageSize && !params.search) {
        const allCategories = await apiService.getAllCategories();
        setCategories(allCategories);
        setTotal(allCategories.length);
        setTotalPages(1);
      } else {
        const response: CategoriesResponse = await apiService.getCategories(params);
        setCategories(response.categories);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar categorias';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [params.search, params.page, params.pageSize]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await apiService.deleteCategory(id);
      toast.success('Categoria excluída com sucesso');
      fetchCategories();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir categoria';
      toast.error(errorMessage);
    }
  }, [fetchCategories]);

  const refresh = useCallback(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    total,
    totalPages,
    loading,
    error,
    refresh,
    deleteCategory,
  };
}