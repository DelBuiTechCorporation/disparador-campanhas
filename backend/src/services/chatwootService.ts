import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const prisma = new PrismaClient();

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
      // Buscar configurações do Chatwoot para o tenant
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings?.chatwootUrl || !settings?.chatwootAccountId || !settings?.chatwootApiToken) {
        throw new Error('Chatwoot não está configurado. Configure na página de Integrações.');
      }

      // Buscar todas as conversas do Chatwoot
      const response = await axios.get(
        `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/conversations`,
        {
          headers: {
            'api_access_token': settings.chatwootApiToken
          }
        }
      );

      const conversations: ChatwootConversation[] = response.data.data?.payload || [];

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

      return tags;
    } catch (error: any) {
      console.error('Erro ao buscar tags do Chatwoot:', error);
      if (error.response) {
        throw new Error(`Erro do Chatwoot: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  async syncContacts(
    tenantId: string,
    tagMappings: TagMapping[]
  ): Promise<{ imported: number; updated: number }> {
    try {
      // Buscar configurações do Chatwoot
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      });

      if (!settings?.chatwootUrl || !settings?.chatwootAccountId || !settings?.chatwootApiToken) {
        throw new Error('Chatwoot não está configurado');
      }

      // Buscar todas as conversas
      const response = await axios.get(
        `${settings.chatwootUrl}/api/v1/accounts/${settings.chatwootAccountId}/conversations`,
        {
          headers: {
            'api_access_token': settings.chatwootApiToken
          }
        }
      );

      const conversations: ChatwootConversation[] = response.data.data?.payload || [];

      let imported = 0;
      let updated = 0;
      const processedContacts = new Set<string>();

      // Processar cada mapping
      for (const mapping of tagMappings) {
        // Filtrar conversas com a tag específica
        const tagConversations = conversations.filter((conv) =>
          conv.labels && conv.labels.includes(mapping.chatwootTag)
        );

        for (const conv of tagConversations) {
          const contact = conv.meta?.sender;

          // Validar se sender existe
          if (!contact) {
            console.log(`Conversa ${conv.id} sem sender, pulando...`);
            continue;
          }

          // Validar telefone
          if (!contact.phone_number) {
            console.log(`Contato ${contact.name} sem telefone, pulando...`);
            continue;
          }

          // Normalizar telefone
          let normalizedPhone: string;
          try {
            const phoneNumber = parsePhoneNumberFromString(contact.phone_number, 'BR');
            if (!phoneNumber || !phoneNumber.isValid()) {
              console.log(`Telefone inválido para ${contact.name}: ${contact.phone_number}`);
              continue;
            }
            normalizedPhone = phoneNumber.format('E.164');
          } catch (error) {
            console.log(`Erro ao processar telefone ${contact.phone_number}:`, error);
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
          }
        }
      }

      return { imported, updated };
    } catch (error: any) {
      console.error('Erro ao sincronizar contatos:', error);
      if (error.response) {
        throw new Error(`Erro do Chatwoot: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }
}
