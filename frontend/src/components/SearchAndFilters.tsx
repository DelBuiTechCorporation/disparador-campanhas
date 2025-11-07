import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Category {
  id: string;
  nome: string;
}

interface SearchAndFiltersProps {
  search: string;
  selectedCategory: string;
  onSearchChange: (search: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClearFilters: () => void;
}

export function SearchAndFilters({
  search,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onClearFilters,
}: SearchAndFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categories = await apiService.getAllCategories();
      setCategories(categories || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Buscar contatos
          </label>
          <input
            id="search"
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Campo de busca para contatos"
          />
        </div>

        <div className="w-full sm:w-64">
          <label htmlFor="category" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nome}
              </option>
            ))}
          </select>
        </div>

        {(search || selectedCategory) && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:underline whitespace-nowrap"
            aria-label="Limpar filtros de busca"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}