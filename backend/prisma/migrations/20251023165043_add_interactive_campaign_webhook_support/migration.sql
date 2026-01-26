-- AlterTable
ALTER TABLE "whatsapp_sessions"
ADD COLUMN "interactive_campaign_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "webhook_secret" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_sessions_webhook_secret_idx" ON "whatsapp_sessions"("webhook_secret");
