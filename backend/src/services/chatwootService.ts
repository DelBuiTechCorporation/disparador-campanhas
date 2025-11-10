import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const prisma = new PrismaClient();

// Helper para adicionar delay entre requisições
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Map para controlar sincronizações em progresso por tenant
const syncInProgress = new Map<string, AbortController>();

interface TagMapping {
  chatwootTag: string;
  categoryId: string;
}

interface ChatwootConversation {
  id: number;
  account_id: number;
  inbox_id: number;
  status: string;
  labels: string[];
  meta: {
    sender: {
      id: number;
      name: string;
      email: string | null;
      phone_number: string | null;
      identifier: string | null;
    };
  };
}

export class ChatwootService {
  async getTags(tenantId: string): Promise<Array<{ name: string; count: number }>> {
    try {
      // Cancelar sincronização anterior do mesmo tenant se estiver em progresso
      if (syncInProgress.has(tenantId)) {
        const previousController = syncInProgress.get(tenantId);
        console.log(`⚠️ Cancelando sincronização anterior do tenant ${tenantId}`);
        previousController?.abort();
      }

      // Criar novo AbortController para esta sincronização
      const abortController = new AbortController();
      syncInProgress.set(tenantId, abortController);

      // Buscar configurações do Chatwoot para o tenant
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings?.chatwootUrl || !settings?.chatwootAccountId || !settings?.chatwootApiToken) {
        syncInProgress.delete(tenantId);
        throw new Error('Chatwoot não está configurado. Configure na página de Integrações.');
      }

      const conversations: ChatwootConversation[] = [];
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      // Paginar através de todas as conversas
      while (hasMore) {
        // Verificar se foi cancelado ANTES de fazer nova requisição
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        try {
          console.log(`📄 Buscando página ${page} de conversas do Chatwoot...`);
          
          const response = await axios.get(
            `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/conversations?page=${page}&per_page=100`,
            {
              headers: {
                'api_access_token': settings.chatwootApiToken
              },
              timeout: 60000, // 60 segundos de timeout
              signal: abortController.signal
            }
          );

          const pageData: ChatwootConversation[] = response.data.data?.payload || [];
          
          if (pageData.length === 0) {
            console.log(`✅ Paginação completa na página ${page} (payload vazio)`);
            hasMore = false;
          } else {
            conversations.push(...pageData);
            pagesFetched++;
            console.log(`✅ Página ${page}: ${pageData.length} conversas carregadas (total: ${conversations.length})`);
            page++;
            
            // Delay de 2 segundos entre requisições para não sobrecarregar
            await delay(2000);
          }
        } catch (error: any) {
          // Se foi cancelado, propagar o erro
          if (abortController.signal.aborted || error.code === 'ERR_CANCELED') {
            console.log(`⚠️ Sincronização cancelada pelo usuário na página ${page}`);
            syncInProgress.delete(tenantId);
            throw new Error('Sincronização cancelada pelo usuário');
          }

          const errorMsg = error.response?.status === 401 
            ? 'Token do Chatwoot inválido ou expirado'
            : error.code === 'ECONNABORTED'
            ? `Timeout na página ${page} (API demorou > 60s)`
            : error.message;
          
          console.warn(`⚠️ Erro na página ${page}: ${errorMsg}`);
          warnings.push(`Erro ao buscar página ${page}: ${errorMsg}`);
          hasWarning = true;
          hasMore = false; // Para na primeira falha
        }
      }

      // Agregar tags e contar contatos únicos por tag
      const tagMap = new Map<string, Set<number>>();

      conversations.forEach((conv) => {
        if (conv.labels && conv.labels.length > 0 && conv.meta?.sender?.id) {
          conv.labels.forEach((tag) => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, new Set());
            }
            tagMap.get(tag)!.add(conv.meta.sender.id);
          });
        }
      });

      // Converter para array de objetos
      const tags = Array.from(tagMap.entries()).map(([name, contactIds]) => ({
        name,
        count: contactIds.size
      }));

      // Ordenar por nome
      tags.sort((a, b) => a.name.localeCompare(b.name));

      const summaryMsg = `✅ Carregadas ${conversations.length} conversas do Chatwoot em ${pagesFetched} páginas com ${tags.length} tags únicas`;
      console.log(summaryMsg);

      if (hasWarning) {
        console.warn(`⚠️ AVISO: Ocorreram problemas durante a sincronização:\n${warnings.join('\n')}`);
      }

      syncInProgress.delete(tenantId);
      return tags;
    } catch (error: any) {
      syncInProgress.delete(tenantId);
      console.error('❌ Erro ao buscar tags do Chatwoot:', error);
      if (error.response) {
        throw new Error(`Erro do Chatwoot: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  async getTagsWithCallback(
    tenantId: string,
    onUpdate: (tags: Array<{ name: string; count: number }>) => void
  ): Promise<Array<{ name: string; count: number }>> {
    try {
      // Cancelar sincronização anterior do mesmo tenant se estiver em progresso
      if (syncInProgress.has(tenantId)) {
        const previousController = syncInProgress.get(tenantId);
        console.log(`⚠️ Cancelando sincronização anterior do tenant ${tenantId}`);
        previousController?.abort();
      }

      // Criar novo AbortController para esta sincronização
      const abortController = new AbortController();
      syncInProgress.set(tenantId, abortController);

      // Buscar configurações do Chatwoot para o tenant
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings?.chatwootUrl || !settings?.chatwootAccountId || !settings?.chatwootApiToken) {
        syncInProgress.delete(tenantId);
        throw new Error('Chatwoot não está configurado. Configure na página de Integrações.');
      }

      const conversations: ChatwootConversation[] = [];
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;
      const tagsAccumulated = new Map<string, Set<number>>();

      // Paginar através de todas as conversas e fazer callbacks
      while (hasMore) {
        // Verificar se foi cancelado ANTES de fazer nova requisição
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        try {
          console.log(`📄 Buscando página ${page} de conversas do Chatwoot...`);
          
          const response = await axios.get(
            `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/conversations?page=${page}&per_page=100`,
            {
              headers: {
                'api_access_token': settings.chatwootApiToken
              },
              timeout: 60000, // 60 segundos de timeout
              signal: abortController.signal
            }
          );

          const pageData: ChatwootConversation[] = response.data.data?.payload || [];
          
          if (pageData.length === 0) {
            console.log(`✅ Paginação completa na página ${page} (payload vazio)`);
            hasMore = false;
          } else {
            conversations.push(...pageData);
            pagesFetched++;
            console.log(`✅ Página ${page}: ${pageData.length} conversas carregadas (total: ${conversations.length})`);
            
            // Atualizar tags e enviar callback
            pageData.forEach((conv) => {
              if (conv.labels && conv.labels.length > 0 && conv.meta?.sender?.id) {
                conv.labels.forEach((tag) => {
                  if (!tagsAccumulated.has(tag)) {
                    tagsAccumulated.set(tag, new Set());
                  }
                  tagsAccumulated.get(tag)?.add(conv.meta.sender.id);
                });
              }
            });

            // Converter mapa para array e enviar via callback
            const tagsArray = Array.from(tagsAccumulated.entries())
              .map(([name, senderIds]) => ({
                name,
                count: senderIds.size
              }))
              .sort((a, b) => b.count - a.count);

            onUpdate(tagsArray);
            
            page++;
            
            // Verificar cancelamento antes do delay
            if (abortController.signal.aborted) {
              console.log(`⚠️ Sincronização cancelada pelo usuário após página ${page-1}`);
              throw new Error('Sincronização cancelada pelo usuário');
            }
            
            // Delay de 2 segundos entre requisições para não sobrecarregar
            await delay(2000);
          }
        } catch (error: any) {
          // Se foi cancelado, propagar o erro
          if (abortController.signal.aborted || error.code === 'ERR_CANCELED') {
            console.log(`⚠️ Sincronização cancelada pelo usuário na página ${page}`);
            syncInProgress.delete(tenantId);
            throw new Error('Sincronização cancelada pelo usuário');
          }

          const errorMsg = error.response?.status === 401 
            ? 'Token do Chatwoot inválido ou expirado'
            : error.code === 'ECONNABORTED'
            ? `Timeout na página ${page} (API demorou > 60s)`
            : error.message;
          
          console.warn(`⚠️ Erro na página ${page}: ${errorMsg}`);
          hasMore = false;
        }
      }

      console.log(`🏁 Carregamento de tags finalizado - Total: ${tagsAccumulated.size} tags únicas`);
      syncInProgress.delete(tenantId);

      // Retornar tags finais
      const finalTags = Array.from(tagsAccumulated.entries())
        .map(([name, senderIds]) => ({
          name,
          count: senderIds.size
        }))
        .sort((a, b) => b.count - a.count);

      console.log(`✅ Carregadas ${finalTags.length} tags únicas do Chatwoot em ${pagesFetched} páginas`);

      syncInProgress.delete(tenantId);
      return finalTags;
    } catch (error: any) {
      syncInProgress.delete(tenantId);
      console.error('❌ Erro ao buscar tags com callback do Chatwoot:', error);
      if (error.response) {
        throw new Error(`Erro do Chatwoot: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  async syncContacts(
    tenantId: string,
    tagMappings: TagMapping[]
  ): Promise<{ imported: number; updated: number; warnings?: string[] }> {
    try {
      // Cancelar sincronização anterior do mesmo tenant se estiver em progresso
      if (syncInProgress.has(tenantId)) {
        const previousController = syncInProgress.get(tenantId);
        console.log(`⚠️ Cancelando sincronização anterior do tenant ${tenantId}`);
        previousController?.abort();
      }

      // Criar novo AbortController para esta sincronização
      const abortController = new AbortController();
      syncInProgress.set(tenantId, abortController);

      // Buscar configurações do Chatwoot
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings?.chatwootUrl || !settings?.chatwootAccountId || !settings?.chatwootApiToken) {
        syncInProgress.delete(tenantId);
        throw new Error('Chatwoot não está configurado');
      }

      // Buscar todas as conversas com paginação
      const conversations: ChatwootConversation[] = [];
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      while (hasMore) {
        // Verificar se foi cancelado ANTES de fazer nova requisição
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        try {
          console.log(`📄 Buscando página ${page} para sincronização...`);
          
          const response = await axios.get(
            `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/conversations?page=${page}&per_page=100`,
            {
              headers: {
                'api_access_token': settings.chatwootApiToken
              },
              timeout: 60000, // 60 segundos de timeout
              signal: abortController.signal
            }
          );

          const pageData: ChatwootConversation[] = response.data.data?.payload || [];
          
          if (pageData.length === 0) {
            console.log(`✅ Paginação completa na página ${page}`);
            hasMore = false;
          } else {
            conversations.push(...pageData);
            pagesFetched++;
            console.log(`✅ Página ${page}: ${pageData.length} conversas (total: ${conversations.length})`);
            page++;
            
            // Delay de 2 segundos entre requisições
            await delay(2000);
          }
        } catch (error: any) {
          // Se foi cancelado, propagar o erro
          if (abortController.signal.aborted || error.code === 'ERR_CANCELED') {
            console.log(`⚠️ Sincronização cancelada pelo usuário na página ${page}`);
            syncInProgress.delete(tenantId);
            throw new Error('Sincronização cancelada pelo usuário');
          }

          const errorMsg = error.response?.status === 401 
            ? 'Token do Chatwoot inválido ou expirado'
            : error.code === 'ECONNABORTED'
            ? `Timeout na página ${page} (API demorou > 60s)`
            : error.message;
          
          console.warn(`⚠️ Erro na página ${page}: ${errorMsg}`);
          warnings.push(`Erro ao buscar página ${page}: ${errorMsg}`);
          hasWarning = true;
          hasMore = false;
        }
      }

      console.log(`📊 Total de ${conversations.length} conversas carregadas do Chatwoot em ${pagesFetched} páginas`);
      console.log(`🔄 Iniciando processamento de ${tagMappings.length} mapeamentos de tags...`);

      let imported = 0;
      let updated = 0;
      const processedContacts = new Set<string>();

      // Processar cada mapping
      for (const mapping of tagMappings) {
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada. Parando processamento`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        // Filtrar conversas com a tag específica
        const tagConversations = conversations.filter((conv) =>
          conv.labels && conv.labels.includes(mapping.chatwootTag)
        );

        console.log(`📋 Tag "${mapping.chatwootTag}": ${tagConversations.length} conversas encontradas → Categoria: ${mapping.categoryId}`);

        for (const conv of tagConversations) {
          const contact = conv.meta?.sender;

          // Validar se sender existe
          if (!contact) {
            console.log(`Conversa ${conv.id} sem sender, pulando...`);
            continue;
          }

          // Obter telefone (phone_number ou identifier como fallback)
          let rawPhone = contact.phone_number;
          
          // Se phone_number vazio, usar identifier
          if (!rawPhone && contact.identifier) {
            // Extrair número do identifier (ex: "5511999999999@s.whatsapp.net" -> "5511999999999")
            rawPhone = contact.identifier.split('@')[0];
            // Adicionar + no início se não tiver
            if (rawPhone && !rawPhone.startsWith('+')) {
              rawPhone = `+${rawPhone}`;
            }
            console.log(`📱 Usando identifier como telefone: ${contact.identifier} -> ${rawPhone}`);
          }

          // Validar se conseguiu obter telefone
          if (!rawPhone) {
            console.log(`Contato ${contact.name} sem telefone ou identifier, pulando...`);
            continue;
          }

          // Normalizar telefone
          let normalizedPhone: string;
          try {
            const phoneNumber = parsePhoneNumberFromString(rawPhone, 'BR');
            if (!phoneNumber || !phoneNumber.isValid()) {
              console.log(`Telefone inválido para ${contact.name}: ${rawPhone}`);
              continue;
            }
            normalizedPhone = phoneNumber.format('E.164');
          } catch (error) {
            console.log(`Erro ao processar telefone ${rawPhone}:`, error);
            continue;
          }

          // Evitar processar o mesmo contato múltiplas vezes
          if (processedContacts.has(normalizedPhone)) {
            continue;
          }
          processedContacts.add(normalizedPhone);

          // Verificar se contato já existe
          const existingContact = await prisma.contact.findFirst({
            where: {
              tenantId,
              telefone: normalizedPhone
            }
          });

          if (existingContact) {
            // Atualizar contato existente
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                nome: contact.name || existingContact.nome,
                email: contact.email || existingContact.email,
                categoriaId: mapping.categoryId,
                observacoes: existingContact.observacoes
                  ? `${existingContact.observacoes}\nImportado do Chatwoot - Tag: ${mapping.chatwootTag}`
                  : `Importado do Chatwoot - Tag: ${mapping.chatwootTag}`
              }
            });
            updated++;
            console.log(`✅ Atualizado: ${contact.name || 'Sem nome'} (${normalizedPhone}) → Categoria: ${mapping.categoryId}`);
          } else {
            // Criar novo contato
            await prisma.contact.create({
              data: {
                tenantId,
                nome: contact.name || 'Sem nome',
                telefone: normalizedPhone,
                email: contact.email,
                categoriaId: mapping.categoryId,
                observacoes: `Importado do Chatwoot - Tag: ${mapping.chatwootTag}`
              }
            });
            imported++;
            console.log(`✅ Importado: ${contact.name || 'Sem nome'} (${normalizedPhone}) → Categoria: ${mapping.categoryId}`);
          }
        }
      }

      const result = { imported, updated };
      if (hasWarning) {
        (result as any).warnings = warnings;
        console.warn(`⚠️ AVISO: Ocorreram problemas durante a sincronização:\n${warnings.join('\n')}`);
      }

      console.log(`✅ Sincronização completa: ${imported} importados, ${updated} atualizados${hasWarning ? ' (com avisos)' : ''}`);

      syncInProgress.delete(tenantId);
      return result;
    } catch (error: any) {
      syncInProgress.delete(tenantId);
      console.error('❌ Erro ao sincronizar contatos:', error);
      if (error.response) {
        throw new Error(`Erro do Chatwoot: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  cancelSync(tenantId: string): void {
    if (syncInProgress.has(tenantId)) {
      const controller = syncInProgress.get(tenantId);
      console.log(`⚠️ Cancelando sincronização do tenant ${tenantId}`);
      controller?.abort();
    }
  }
}
