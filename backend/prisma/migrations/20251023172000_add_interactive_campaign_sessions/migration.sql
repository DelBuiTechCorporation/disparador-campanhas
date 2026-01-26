-- CreateTable
CREATE TABLE "interactive_campaign_sessions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "current_node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "last_message_at" TIMESTAMP(3),
    "last_response" TEXT,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactive_campaign_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interactive_campaign_sessions_campaign_id_idx" ON "interactive_campaign_sessions"("campaign_id");

-- CreateIndex
CREATE INDEX "interactive_campaign_sessions_contact_id_idx" ON "interactive_campaign_sessions"("contact_id");

-- CreateIndex
CREATE INDEX "interactive_campaign_sessions_contact_phone_idx" ON "interactive_campaign_sessions"("contact_phone");

-- CreateIndex
CREATE INDEX "interactive_campaign_sessions_status_idx" ON "interactive_campaign_sessions"("status");

-- CreateIndex
CREATE INDEX "interactive_campaign_sessions_tenant_id_idx" ON "interactive_campaign_sessions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "interactive_campaign_sessions_campaign_id_contact_id_key" ON "interactive_campaign_sessions"("campaign_id", "contact_id");

-- AddForeignKey
ALTER TABLE "interactive_campaign_sessions" ADD CONSTRAINT "interactive_campaign_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "interactive_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactive_campaign_sessions" ADD CONSTRAINT "interactive_campaign_sessions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactive_campaign_sessions" ADD CONSTRAINT "interactive_campaign_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
