-- CreateTable: contact_categories (tabela de junção many-to-many)
CREATE TABLE "contact_categories" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_categories_contact_id_category_id_key" ON "contact_categories"("contact_id", "category_id");

-- CreateIndex
CREATE INDEX "contact_categories_contact_id_idx" ON "contact_categories"("contact_id");

-- CreateIndex
CREATE INDEX "contact_categories_category_id_idx" ON "contact_categories"("category_id");

-- AddForeignKey
ALTER TABLE "contact_categories" ADD CONSTRAINT "contact_categories_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_categories" ADD CONSTRAINT "contact_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar dados existentes da coluna categoria_id para a nova tabela
-- Apenas para contatos que já possuem uma categoria definida
INSERT INTO "contact_categories" ("id", "contact_id", "category_id", "created_at", "updated_at")
SELECT 
    gen_random_uuid(),
    c."id",
    c."categoria_id",
    NOW(),
    NOW()
FROM "contacts" c
WHERE c."categoria_id" IS NOT NULL;

-- Comentário: A coluna categoria_id é mantida para compatibilidade com código legado
-- mas agora deve-se usar a tabela contact_categories para a relação many-to-many
