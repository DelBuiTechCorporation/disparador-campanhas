const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/chatwootService.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Adicionar import do pg
content = content.replace(
  `import { parsePhoneNumberFromString } from 'libphonenumber-js';`,
  `import { parsePhoneNumberFromString } from 'libphonenumber-js';\nimport { Pool } from 'pg';`
);

// 2. Adicionar pool após prisma
content = content.replace(
  `const prisma = new PrismaClient();`,
  `const prisma = new PrismaClient();

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
}`
);

// 3. Adicionar método privado após "export class ChatwootService {"
const methodCode = `
  /**
   * Busca contatos diretamente do banco PostgreSQL do Chatwoot (se PG_CHATWOOT_URL está configurado)
   * Retorna contatos no mesmo formato da API REST para compatibilidade
   */
  private async getContactsFromDatabase(accountId: string): Promise<ChatwootContact[]> {
    if (!pgPool) {
      throw new Error('PG_CHATWOOT_URL não está configurado');
    }

    console.log(\`🗄️ Buscando contatos diretamente do banco Chatwoot (account \${accountId})...\`);
    
    const query = \`
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
    \`;

    try {
      const result = await pgPool.query(query, [accountId]);
      console.log(\`📊 Query retornou \${result.rows.length} linhas (contato+tag combinações)\`);

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
        console.log(\`🚫 Ignorados \${contacts.length - filteredContacts.length} grupos (@g.us)\`);
      }

      console.log(\`✅ \${filteredContacts.length} contatos únicos carregados do banco Chatwoot\`);
      return filteredContacts;

    } catch (error: any) {
      console.error('❌ Erro ao buscar contatos do banco Chatwoot:', error);
      throw new Error(\`Erro ao acessar banco Chatwoot: \${error.message}\`);
    }
  }
`;

content = content.replace(
  'export class ChatwootService {',
  `export class ChatwootService {${methodCode}`
);

// 4. Modificar getTags para usar pgPool
content = content.replace(
  `      const contacts: ChatwootContact[] = [];
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      // Paginar através de todos os contatos
      while (hasMore) {`,
  `      let contacts: ChatwootContact[] = [];
      let pagesFetched = 0;
      let hasWarning = false;
      const warnings: string[] = [];

      // **SE PG_CHATWOOT_URL ESTIVER CONFIGURADO, USAR BANCO DIRETO**
      if (pgPool) {
        console.log('🗄️ Usando acesso direto ao banco Chatwoot (via PG_CHATWOOT_URL)');
        try {
          contacts = await this.getContactsFromDatabase(settings.chatwootAccountId);
        } catch (error: any) {
          console.warn(\`⚠️ Erro ao buscar do banco, fallback para API: \${error.message}\`);
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
        while (hasMore) {`
);

// 5. Fechar bloco if antes de agregar tags
content = content.replace(
  `      }

      // Agregar tags e contar`,
  `      }
      }

      // Agregar tags e contar`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Arquivo modificado com sucesso!');
console.log('📝 Adicione PG_CHATWOOT_URL no seu .env para habilitar busca direta no banco');
