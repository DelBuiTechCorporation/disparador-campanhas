import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ContactInput, Contact } from '../types';
import { apiService } from '../services/api';
import { validatePhone } from '../utils/phoneUtils';

interface Category {
  id: string;
  nome: string;
}

const contactSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().min(1, 'Telefone é obrigatório').refine(validatePhone, {
    message: 'Formato de telefone inválido',
  }),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  observacoes: z.string().optional(),
  categoriaId: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({ contact, onSuccess, onCancel }: ContactFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: contact?.nome || '',
      telefone: contact?.telefone || '',
      email: contact?.email || '',
      observacoes: contact?.observacoes || '',
      categoriaId: contact?.categoriaId || '',
    },
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categories = await apiService.getAllCategories();
      setCategories(categories || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const onSubmit = async (data: ContactFormData) => {
    try {
      const contactInput: ContactInput = {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || undefined,
        observacoes: data.observacoes || undefined,
        categoriaId: data.categoriaId || undefined,
      };

      if (contact) {
        await apiService.updateContact(contact.id, contactInput);
        toast.success('Contato atualizado com sucesso');
      } else {
        await apiService.createContact(contactInput);
        toast.success('Contato criado com sucesso');
      }

      onSuccess();
    } catch (err: any) {
      // Verificar se é erro de quota
      if (err?.isQuotaError || err?.upgradeRequired) {
        toast.error(err.message || 'Limite de contatos atingido. Faça upgrade do seu plano para continuar.', {
          duration: 6000,
          icon: '⚠️'
        });
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar contato';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-100" role="dialog" aria-labelledby="form-title">
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 id="form-title" className="text-xl sm:text-2xl font-bold text-gray-900">
            {contact ? 'Editar Contato' : 'Novo Contato'}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1 sm:mt-2">
            {contact ? 'Atualize as informações do contato' : 'Preencha os dados para criar um novo contato'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5 md:space-y-6">
          <div>
            <label htmlFor="nome" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              Nome *
            </label>
            <input
              id="nome"
              type="text"
              {...register('nome')}
              className="input-field text-sm sm:text-base"
              placeholder="Digite o nome completo"
            />
            {errors.nome && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.nome.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              Telefone *
            </label>
            <input
              id="telefone"
              type="tel"
              {...register('telefone')}
              placeholder="+55 11 99999-9999"
              className="input-field text-sm sm:text-base"
            />
            {errors.telefone && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.telefone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="input-field text-sm sm:text-base"
              placeholder="Digite o email"
            />
            {errors.email && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>


          <div>
            <label htmlFor="categoriaId" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              Categoria
            </label>
            <select
              id="categoriaId"
              {...register('categoriaId')}
              className="input-field text-sm sm:text-base"
              disabled={loadingCategories}
            >
              <option value="">Selecione uma categoria</option>
              {loadingCategories ? (
                <option disabled>Carregando categorias...</option>
              ) : (
                categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nome}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="observacoes" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              Observações
            </label>
            <textarea
              id="observacoes"
              {...register('observacoes')}
              rows={3}
              className="input-field resize-none text-sm sm:text-base"
              placeholder="Digite observações adicionais"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:flex-1 bg-gray-100 text-gray-700 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl hover:bg-gray-200 font-medium transition-all duration-200 border border-gray-200 text-sm sm:text-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full sm:flex-1 py-2.5 sm:py-3 px-4 sm:px-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                'Salvar Contato'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}