import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Pool } from 'pg';

const prisma = new PrismaClient();

// Pool de conexão PostgreSQL para acesso direto ao banco do Chatwoot (se configurado)
let pgPool: Pool | null = null;

// Inicializar pool se PG_CHATWOOT_URL estiver configurado
if (process.env.PG_CHATWOOT_URL) {
  console.log('🔌 PG_CHATWOOT_URL detectado - Habilitando acesso direto ao banco Chatwoot');
  pgPool = new Pool({
    connectionString: process.env.PG_CHATWOOT_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  pgPool.on('error', (err) => {
    console.error('❌ Erro no pool PostgreSQL do Chatwoot:', err);
  });
}

// Helper para adicionar delay entre requisições
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Map para controlar sincronizações em progresso por tenant
const syncInProgress = new Map<string, AbortController>();

// Cache de contatos paginados com TTL
interface ContactsCache {
  data: ChatwootContact[];
  timestamp: number;
  ttl: number; // em milissegundos
}
const contactsCache = new Map<string, ContactsCache>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

interface TagMapping {
  chatwootTag: string;
  categoryId: string;
}

interface ChatwootContact {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
  identifier: string | null;
  labels: string[];
}

export class ChatwootService {
  /**
   * Busca contatos diretamente do banco PostgreSQL do Chatwoot (se PG_CHATWOOT_URL está configurado)
   * Retorna contatos no mesmo formato da API REST para compatibilidade
   */
  private async getContactsFromDatabase(accountId: string): Promise<ChatwootContact[]> {
    if (!pgPool) {
      throw new Error('PG_CHATWOOT_URL não está configurado');
    }

    console.log(`🗄️ Buscando contatos diretamente do banco Chatwoot (account ${accountId})...`);
    
    const query = `
      SELECT 
        c.id AS contact_id,
        c.name AS contact_name,
        c.identifier AS contact_identifier,
        c.phone_number AS contact_phone_number,
        c.email AS contact_email,
        t.name AS tag_name
      FROM contacts c
      INNER JOIN taggings tgs 
        ON tgs.taggable_id = c.id 
        AND tgs.taggable_type = 'Contact'
        AND tgs.context = 'labels'
      INNER JOIN tags t 
        ON t.id = tgs.tag_id
      WHERE c.account_id = $1
      ORDER BY c.id, t.name;
    `;

    try {
      const result = await pgPool.query(query, [accountId]);
      console.log(`📊 Query retornou ${result.rows.length} linhas (contato+tag combinações)`);

      // Agrupar por contato (pois query retorna 1 linha por contato+tag)
      const contactsMap = new Map<number, ChatwootContact>();

      for (const row of result.rows) {
        const contactId = row.contact_id;
        
        if (!contactsMap.has(contactId)) {
          contactsMap.set(contactId, {
            id: contactId,
            name: row.contact_name || '',
            email: row.contact_email || null,
            phone_number: row.contact_phone_number || null,
            identifier: row.contact_identifier || null,
            labels: []
          });
        }

        // Adicionar tag ao contato
        const contact = contactsMap.get(contactId)!;
        if (row.tag_name && !contact.labels.includes(row.tag_name)) {
          contact.labels.push(row.tag_name);
        }
      }

      const contacts = Array.from(contactsMap.values());
      
      // Filtrar grupos (@g.us)
      const filteredContacts = contacts.filter(c => !c.identifier?.endsWith('@g.us'));
      
      if (filteredContacts.length < contacts.length) {
        console.log(`🚫 Ignorados ${contacts.length - filteredContacts.length} grupos (@g.us)`);
      }

      console.log(`✅ ${filteredContacts.length} contatos únicos carregados do banco Chatwoot`);
      return filteredContacts;

    } catch (error: any) {
      console.error('❌ Erro ao buscar contatos do banco Chatwoot:', error);
      throw new Error(`Erro ao acessar banco Chatwoot: ${error.message}`);
    }
  }

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

      let contacts: ChatwootContact[] = [];
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      // **SE PG_CHATWOOT_URL ESTIVER CONFIGURADO, USAR BANCO DIRETO**
      if (pgPool) {
        console.log('🗄️ Usando acesso direto ao banco Chatwoot (via PG_CHATWOOT_URL)');
        try {
          contacts = await this.getContactsFromDatabase(settings.chatwootAccountId);
        } catch (error: any) {
          console.warn(`⚠️ Erro ao buscar do banco, fallback para API: ${error.message}`);
        }
      }

      // **USAR PAGINAÇÃO VIA API REST se pgPool não disponível ou falhou**
      if (contacts.length === 0) {
        if (!pgPool) {
          console.log('🌐 Usando API REST do Chatwoot (paginação)');
        }

        let page = 1;
        let hasMore = true;

        // Paginar através de todos os contatos
        while (hasMore) {
        // Verificar se foi cancelado ANTES de fazer nova requisição
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        try {
          console.log(`📄 Buscando página ${page} de contatos do Chatwoot...`);
          
          const response = await axios.get(
            `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/contacts?page=${page}&sort=name`,
            {
              headers: {
                'api_access_token': settings.chatwootApiToken
              },
              timeout: 60000, // 60 segundos de timeout
              signal: abortController.signal
            }
          );

          const pageData: ChatwootContact[] = response.data.payload || [];
          
          if (pageData.length === 0) {
            console.log(`✅ Paginação completa na página ${page} (payload vazio)`);
            hasMore = false;
          } else {
            // Filtrar contatos de grupos (identifier terminando em @g.us)
            const filteredData = pageData.filter(contact => !contact.identifier?.endsWith('@g.us'));
            if (filteredData.length < pageData.length) {
              console.log(`🚫 Ignorados ${pageData.length - filteredData.length} grupos (@g.us)`);
            }
            contacts.push(...filteredData);
            pagesFetched++;
            console.log(`✅ Página ${page}: ${filteredData.length} contatos carregados (total: ${contacts.length})`);
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
      }

      // Agregar tags e contar contatos únicos por tag
      const tagMap = new Map<string, Set<number>>();

      contacts.forEach((contact) => {
        if (contact.labels && contact.labels.length > 0 && contact.id) {
          contact.labels.forEach((tag) => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, new Set());
            }
            tagMap.get(tag)!.add(contact.id);
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

      const summaryMsg = `✅ Carregados ${contacts.length} contatos do Chatwoot em ${pagesFetched} páginas com ${tags.length} tags únicas`;
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

      const contacts: ChatwootContact[] = [];
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;
      const tagsAccumulated = new Map<string, Set<number>>();

      // Paginar através de todos os contatos e fazer callbacks
      while (hasMore) {
        // Verificar se foi cancelado ANTES de fazer nova requisição
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
          // Salvar cache mesmo se cancelado (contatos já carregados)
          if (contacts.length > 0) {
            contactsCache.set(tenantId, {
              data: contacts,
              timestamp: Date.now(),
              ttl: CACHE_TTL
            });
            console.log(`💾 Cache salvo mesmo com cancelamento: ${contacts.length} contatos armazenados`);
          }
          throw new Error('Sincronização cancelada pelo usuário');
        }

        try {
          console.log(`📄 Buscando página ${page} de contatos do Chatwoot...`);
          
          const response = await axios.get(
            `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/contacts?page=${page}&sort=name`,
            {
              headers: {
                'api_access_token': settings.chatwootApiToken
              },
              timeout: 60000, // 60 segundos de timeout
              signal: abortController.signal
            }
          );

          const pageData: ChatwootContact[] = response.data.payload || [];
          
          if (pageData.length === 0) {
            console.log(`✅ Paginação completa na página ${page} (payload vazio)`);
            hasMore = false;
          } else {
            // Filtrar contatos de grupos (identifier terminando em @g.us)
            const filteredData = pageData.filter(contact => !contact.identifier?.endsWith('@g.us'));
            if (filteredData.length < pageData.length) {
              console.log(`🚫 Ignorados ${pageData.length - filteredData.length} grupos (@g.us)`);
            }
            contacts.push(...filteredData);
            pagesFetched++;
            console.log(`✅ Página ${page}: ${filteredData.length} contatos carregados (total: ${contacts.length})`);
            
            // Atualizar tags e enviar callback
            filteredData.forEach((contact) => {
              if (contact.labels && contact.labels.length > 0 && contact.id) {
                contact.labels.forEach((tag) => {
                  if (!tagsAccumulated.has(tag)) {
                    tagsAccumulated.set(tag, new Set());
                  }
                  tagsAccumulated.get(tag)?.add(contact.id);
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
            
            // Salvar cache progressivamente a cada página
            contactsCache.set(tenantId, {
              data: contacts,
              timestamp: Date.now(),
              ttl: CACHE_TTL
            });
            console.log(`💾 Cache atualizado progressivamente: ${contacts.length} contatos`);
            
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
          // Se foi cancelado, propagar o erro (cache já foi salvo acima)
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
      
      // Salvar contatos no cache (final ou cancelado)
      contactsCache.set(tenantId, {
        data: contacts,
        timestamp: Date.now(),
        ttl: CACHE_TTL
      });
      console.log(`💾 Cache finalizado para tenant ${tenantId}: ${contacts.length} contatos (válido por 10 minutos)`);
      
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

      // Verificar se existe cache válido
      const cached = contactsCache.get(tenantId);
      let contacts: ChatwootContact[];
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      if (cached) {
        const age = Date.now() - cached.timestamp;
        const remainingTTL = cached.ttl - age;
        const isValid = remainingTTL > 0;
        
        console.log(`💾 Cache encontrado: ${cached.data.length} contatos`);
        console.log(`💾 Idade do cache: ${Math.round(age / 1000)}s`);
        console.log(`💾 TTL restante: ${Math.round(remainingTTL / 1000)}s`);
        console.log(`💾 Cache válido: ${isValid ? 'SIM ✅' : 'NÃO (expirado) ❌'}`);
      } else {
        console.log(`💾 Nenhum cache encontrado para tenant ${tenantId}`);
      }

      if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
        console.log(`📦 Usando contatos em cache (${cached.data.length} contatos) - evitando re-paginação!`);
        contacts = cached.data;
      } else {
        if (cached) {
          console.log(`⏰ Cache expirado, buscando contatos novamente...`);
        } else {
          console.log(`🔍 Nenhum cache disponível, iniciando paginação...`);
        }

        // Buscar todos os contatos com paginação
        contacts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          // Verificar se foi cancelado ANTES de fazer nova requisição
          if (abortController.signal.aborted) {
            console.log(`⚠️ Sincronização cancelada pelo usuário. Parando loop de paginação`);
            throw new Error('Sincronização cancelada pelo usuário');
          }

          try {
            console.log(`📄 Buscando página ${page} para sincronização...`);
            
            const response = await axios.get(
              `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/contacts?page=${page}&sort=name`,
              {
                headers: {
                  'api_access_token': settings.chatwootApiToken
                },
                timeout: 60000, // 60 segundos de timeout
                signal: abortController.signal
              }
            );

            const pageData: ChatwootContact[] = response.data.payload || [];
            
            if (pageData.length === 0) {
              console.log(`✅ Paginação completa na página ${page}`);
              hasMore = false;
            } else {
              // Filtrar contatos de grupos (identifier terminando em @g.us)
              const filteredData = pageData.filter(contact => !contact.identifier?.endsWith('@g.us'));
              if (filteredData.length < pageData.length) {
                console.log(`🚫 Ignorados ${pageData.length - filteredData.length} grupos (@g.us)`);
              }
              contacts.push(...filteredData);
              pagesFetched++;
              console.log(`✅ Página ${page}: ${filteredData.length} contatos (total: ${contacts.length})`);
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

        // Salvar no cache
        contactsCache.set(tenantId, {
          data: contacts,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
        console.log(`💾 Cache atualizado: ${contacts.length} contatos armazenados`);
      }

      console.log(`📊 Total de ${contacts.length} contatos ${cached && (Date.now() - cached.timestamp) < cached.ttl ? 'do cache' : `carregados em ${pagesFetched} páginas`}`);
      console.log(`🔄 Iniciando processamento de ${tagMappings.length} mapeamentos de tags...`);

      let imported = 0;
      let updated = 0;
      const processedPhoneCategories = new Map<string, Set<string>>(); // Track phone + category combos

      // Processar cada mapping
      for (const mapping of tagMappings) {
        if (abortController.signal.aborted) {
          console.log(`⚠️ Sincronização cancelada. Parando processamento`);
          throw new Error('Sincronização cancelada pelo usuário');
        }

        // Filtrar contatos com a tag específica
        const tagContacts = contacts.filter((contact) =>
          contact.labels && contact.labels.includes(mapping.chatwootTag)
        );

        console.log(`📋 Tag "${mapping.chatwootTag}": ${tagContacts.length} contatos encontrados → Categoria: ${mapping.categoryId}`);

        for (const contact of tagContacts) {
          // Validar se contato existe
          if (!contact) {
            console.log(`Contato inválido, pulando...`);
            continue;
          }

          // Obter telefone (phone_number ou source_id como fallback)
          let rawPhone = contact.phone_number;
          
          // Se ainda não tem telefone, usar identifier como fallback
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
            console.log(`Contato ${contact.name} sem telefone, source_id ou identifier, pulando...`);
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

          // Evitar processar a mesma combinação phone+category múltiplas vezes
          if (!processedPhoneCategories.has(normalizedPhone)) {
            processedPhoneCategories.set(normalizedPhone, new Set());
          }
          const phoneCategories = processedPhoneCategories.get(normalizedPhone)!;
          
          if (phoneCategories.has(mapping.categoryId)) {
            console.log(`ℹ️ Combinação ${normalizedPhone} + categoria ${mapping.categoryId} já processada, pulando...`);
            continue;
          }
          phoneCategories.add(mapping.categoryId);

          // Verificar se contato já existe
          const existingContact = await prisma.contact.findFirst({
            where: {
              tenantId,
              telefone: normalizedPhone
            },
            include: {
              categories: {
                include: {
                  category: true
                }
              }
            }
          });

          if (existingContact) {
            // Verificar se a categoria já está associada
            const categoryExists = existingContact.categories.some(
              cc => cc.categoryId === mapping.categoryId
            );

            if (!categoryExists) {
              // Adicionar nova categoria ao contato existente (many-to-many)
              await prisma.contactCategory.create({
                data: {
                  contactId: existingContact.id,
                  categoryId: mapping.categoryId
                }
              });
              console.log(`✅ Adicionada categoria "${mapping.chatwootTag}" ao contato: ${contact.name || 'Sem nome'} (${normalizedPhone})`);
            } else {
              console.log(`ℹ️ Contato ${contact.name || 'Sem nome'} já possui a categoria "${mapping.chatwootTag}"`);
            }

            // Atualizar dados básicos do contato (nome, email) se necessário
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                nome: contact.name || existingContact.nome,
                email: contact.email || existingContact.email,
                observacoes: existingContact.observacoes && !existingContact.observacoes.includes(mapping.chatwootTag)
                  ? `${existingContact.observacoes}\nTag Chatwoot: ${mapping.chatwootTag}`
                  : existingContact.observacoes || `Tag Chatwoot: ${mapping.chatwootTag}`
              }
            });
            updated++;
          } else {
            // Criar novo contato
            const newContact = await prisma.contact.create({
              data: {
                tenantId,
                nome: contact.name || 'Sem nome',
                telefone: normalizedPhone,
                email: contact.email,
                observacoes: `Importado do Chatwoot - Tag: ${mapping.chatwootTag}`
              }
            });

            // Associar categoria ao novo contato (many-to-many)
            await prisma.contactCategory.create({
              data: {
                contactId: newContact.id,
                categoryId: mapping.categoryId
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

  clearCache(tenantId: string): void {
    if (contactsCache.has(tenantId)) {
      const cache = contactsCache.get(tenantId);
      console.log(`🗑️ Limpando cache de ${cache?.data.length} contatos do tenant ${tenantId}`);
      contactsCache.delete(tenantId);
    } else {
      console.log(`ℹ️ Nenhum cache encontrado para o tenant ${tenantId}`);
    }
  }
}
