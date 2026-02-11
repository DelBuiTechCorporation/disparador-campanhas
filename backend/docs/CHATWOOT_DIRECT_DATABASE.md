# Integração Chatwoot - Acesso Direto ao Banco

## 📋 Visão Geral

O sistema suporta **dois modos** de buscar contatos do Chatwoot:

1. **API REST + Paginação** (padrão) - Usa a API HTTP do Chatwoot
2. **Acesso Direto ao Banco** (opcional) - Conecta direto no PostgreSQL do Chatwoot

## 🚀 Como Ativar o Acesso Direto

### Passo 1: Configurar Variáveis de Ambiente

Adicione no arquivo `.env`:

```bash
# URL de conexão ao banco PostgreSQL do Chatwoot
PG_CHATWOOT_URL=postgresql://user:password@host:port/database

# URL base do Chatwoot que pode usar acesso direto (opcional)
# Se não configurado, o acesso direto não será usado mesmo com PG_CHATWOOT_URL
CHATWOOT_BASE_URL=seu-dominio.com.br
```

**Exemplo:**
```bash
PG_CHATWOOT_URL=postgresql://chatwoot:senha123@129.153.128.240:5434/iago?schema=iago
CHATWOOT_BASE_URL=iago.5xaceleradora.com.br
```

**Importante:** O acesso direto só será usado se:
- `PG_CHATWOOT_URL` estiver configurado
- `CHATWOOT_BASE_URL` estiver configurado
- A URL do Chatwoot configurada no tenant **contenha** o valor de `CHATWOOT_BASE_URL`

### Passo 2: Reiniciar o Backend

```bash
docker service update --force work_backend
# ou em desenvolvimento:
npm run dev
```

## ⚡ Vantagens do Acesso Direto

| Característica | API REST | Banco Direto |
|---------------|----------|--------------|
| **Velocidade** | Lenta (paginação) | **Muito rápida** (1 query) |
| **Requisições** | Múltiplas (2s delay cada) | **Uma única** consulta SQL |
| **Timeout** | Pode dar timeout em grandes bases | Sem timeout |
| **Dependência** | API HTTP do Chatwoot | Acesso direto ao banco |

## 🔍 Como Funciona

### Modo API REST (sem `PG_CHATWOOT_URL`)
```
1. GET /api/v1/accounts/14/contacts?page=1
2. Aguarda 2 segundos
3. GET /api/v1/accounts/14/contacts?page=2
4. Aguarda 2 segundos
... até não ter mais páginas
```

### Modo Banco Direto (com `PG_CHATWOOT_URL`)
```sql
SELECT 
  c.id, c.name, c.identifier, c.phone_number, c.email,
  t.name AS tag_name
FROM contacts c
INNER JOIN taggings tgs ON tgs.taggable_id = c.id
INNER JOIN tags t ON t.id = tgs.tag_id
WHERE c.account_id = $1;
```
**Retorna TODOS os contatos em uma única consulta!**

## 📊 Query SQL Utilizada

A query busca:
- ✅ Contatos com suas informações básicas
- ✅ Tags associadas aos contatos
- ✅ Filtragem por `account_id`
- ✅ Exclusão automática de grupos (@g.us)

## 🔒 Segurança

- Use **usuário read-only** no banco Chatwoot
- A query é **somente leitura** (SELECT)
- Conexão via pool com timeout configurado

## 📝 Logs

O sistema detecta automaticamente qual modo está usando:

```bash
# Com PG_CHATWOOT_URL:
🔌 PG_CHATWOOT_URL detectado - Habilitando acesso direto ao banco Chatwoot
🗄️ Usando acesso direto ao banco Chatwoot (via PG_CHATWOOT_URL)
📊 Query retornou 1523 linhas (contato+tag combinações)
✅ 487 contatos únicos carregados do banco Chatwoot

# Sem PG_CHATWOOT_URL:
🌐 Usando API REST do Chatwoot (paginação)
📄 Buscando página 1 de contatos do Chatwoot...
✅ Página 1: 100 contatos carregados (total: 100)
```

## ⚠️ Fallback Automático

Se o acesso ao banco falhar, o sistema **automaticamente** usa a API REST:

```bash
⚠️ Erro ao buscar do banco, fallback para API: connection timeout
🌐 Usando API REST do Chatwoot (paginação)
```

## 🎯 Testando

1. **Sem PG_CHATWOOT_URL**: Comportamento normal (API REST)
2. **Com PG_CHATWOOT_URL**: Busca instantânea do banco
3. **Com PG_CHATWOOT_URL inválido**: Fallback automático para API

## 📦 Dependências

O pacote `pg` (PostgreSQL client) foi adicionado automaticamente:

```json
{
  "dependencies": {
    "pg": "^8.x",
    "@types/pg": "^8.x"
  }
}
```

## 🐛 Troubleshooting

### Erro: "connection refused"
- Verifique se o host/porta do Chatwoot PostgreSQL estão corretos
- Certifique-se que o firewall permite conexão

### Erro: "authentication failed"
- Verifique usuário/senha no `PG_CHATWOOT_URL`
- Confirme permissões no banco Chatwoot

### Erro: "database does not exist"
- Verifique o nome do banco (normalmente `chatwoot_production`)

---

**Criado em:** 11/02/2026  
**Autor:** Sistema Astra Campaign  
**Versão:** 1.0
