-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "perfex_lead_id" TEXT;

-- CreateIndex
CREATE INDEX "contacts_perfex_lead_id_idx" ON "contacts"("perfex_lead_id");
