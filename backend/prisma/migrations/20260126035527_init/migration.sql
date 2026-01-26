-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowed_providers" TEXT NOT NULL DEFAULT 'WAHA',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tenant_quotas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "max_users" INTEGER NOT NULL DEFAULT 10,
    "max_contacts" INTEGER NOT NULL DEFAULT 1000,
    "max_campaigns" INTEGER NOT NULL DEFAULT 50,
    "max_connections" INTEGER NOT NULL DEFAULT 5,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tenant_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "openai_api_key" TEXT,
    "groq_api_key" TEXT,
    "custom_branding" JSONB,
    "chatwoot_url" TEXT,
    "chatwoot_account_id" TEXT,
    "chatwoot_api_token" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "waha_host" TEXT NOT NULL DEFAULT '',
    "waha_api_key" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "icon_url" TEXT,
    "company_name" TEXT,
    "page_title" TEXT,
    "primary_color" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "tags" TEXT NOT NULL,
    "observacoes" TEXT,
    "categoria_id" TEXT,
    "tenant_id" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "contacts_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "descricao" TEXT,
    "tenant_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "status" TEXT NOT NULL,
    "config" TEXT,
    "me_id" TEXT,
    "me_push_name" TEXT,
    "me_lid" TEXT,
    "me_jid" TEXT,
    "qr" TEXT,
    "qr_expires_at" DATETIME,
    "assigned_worker" TEXT,
    "tenant_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'WAHA',
    "interactive_campaign_enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhook_secret" TEXT,
    CONSTRAINT "whatsapp_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "targetTags" TEXT NOT NULL,
    "session_name" TEXT,
    "message_type" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "random_delay" INTEGER NOT NULL,
    "min_random_delay" INTEGER NOT NULL DEFAULT 0,
    "start_immediately" BOOLEAN NOT NULL,
    "scheduled_for" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_contacts" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "tenant_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "session_names" TEXT,
    "created_by" TEXT,
    "created_by_name" TEXT,
    CONSTRAINT "campaigns_session_name_fkey" FOREIGN KEY ("session_name") REFERENCES "whatsapp_sessions" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" DATETIME,
    "delivered_at" DATETIME,
    "read_at" DATETIME,
    "error_message" TEXT,
    "message_id" TEXT,
    "selected_variation" TEXT,
    "tenant_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "session_name" TEXT,
    CONSTRAINT "campaign_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tenant_id" TEXT,
    "ultimo_login" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" DATETIME,
    "resolved_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" DATETIME,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "media_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "message_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_flows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenant_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "automation_flows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_flows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executed_at" DATETIME NOT NULL,
    "context" JSONB,
    "error" TEXT,
    "duration" INTEGER,
    CONSTRAINT "automation_executions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "automation_flows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "credentials" JSONB,
    "webhook_url" TEXT,
    "last_sync_at" DATETIME,
    "last_error" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integration_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "records_count" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "started_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    CONSTRAINT "integration_syncs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "monday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "monday_start" TEXT,
    "monday_end" TEXT,
    "monday_lunch_start" TEXT,
    "monday_lunch_end" TEXT,
    "tuesday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tuesday_start" TEXT,
    "tuesday_end" TEXT,
    "tuesday_lunch_start" TEXT,
    "tuesday_lunch_end" TEXT,
    "wednesday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "wednesday_start" TEXT,
    "wednesday_end" TEXT,
    "wednesday_lunch_start" TEXT,
    "wednesday_lunch_end" TEXT,
    "thursday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "thursday_start" TEXT,
    "thursday_end" TEXT,
    "thursday_lunch_start" TEXT,
    "thursday_lunch_end" TEXT,
    "friday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "friday_start" TEXT,
    "friday_end" TEXT,
    "friday_lunch_start" TEXT,
    "friday_lunch_end" TEXT,
    "saturday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "saturday_start" TEXT,
    "saturday_end" TEXT,
    "saturday_lunch_start" TEXT,
    "saturday_lunch_end" TEXT,
    "sunday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sunday_start" TEXT,
    "sunday_end" TEXT,
    "sunday_lunch_start" TEXT,
    "sunday_lunch_end" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "business_hours_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "instance_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "callback_url" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "tenant_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interactive_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connection_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduled_date" DATETIME,
    "graph" JSONB NOT NULL,
    "tenant_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interactive_campaigns_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interactive_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interactive_campaign_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "current_node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "variables" JSONB NOT NULL DEFAULT {},
    "visited_nodes" JSONB NOT NULL DEFAULT [],
    "last_message_at" DATETIME,
    "last_response" TEXT,
    "tenant_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interactive_campaign_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "interactive_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interactive_campaign_sessions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interactive_campaign_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connection_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "content" TEXT,
    "payload" JSONB,
    "status" TEXT,
    "timestamp" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connection_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_subscriptions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quotas_tenant_id_key" ON "tenant_quotas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "user_tenants_user_id_idx" ON "user_tenants"("user_id");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "user_tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenants_user_id_tenant_id_key" ON "user_tenants"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_singleton_key" ON "global_settings"("singleton");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");

-- CreateIndex
CREATE INDEX "contacts_categoria_id_idx" ON "contacts"("categoria_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_name_key" ON "whatsapp_sessions"("name");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_tenant_id_idx" ON "whatsapp_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns"("tenant_id");

-- CreateIndex
CREATE INDEX "campaign_messages_tenant_id_idx" ON "campaign_messages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "alerts_tenant_id_idx" ON "alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "alerts_type_severity_idx" ON "alerts"("type", "severity");

-- CreateIndex
CREATE INDEX "alerts_resolved_created_at_idx" ON "alerts"("resolved", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_alert_id_idx" ON "notifications"("alert_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_read_idx" ON "user_notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications"("created_at");

-- CreateIndex
CREATE INDEX "message_templates_tenant_id_idx" ON "message_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "message_templates_category_idx" ON "message_templates"("category");

-- CreateIndex
CREATE INDEX "message_templates_message_type_idx" ON "message_templates"("message_type");

-- CreateIndex
CREATE INDEX "message_templates_active_idx" ON "message_templates"("active");

-- CreateIndex
CREATE INDEX "automation_flows_tenant_id_idx" ON "automation_flows"("tenant_id");

-- CreateIndex
CREATE INDEX "automation_flows_active_idx" ON "automation_flows"("active");

-- CreateIndex
CREATE INDEX "automation_executions_flow_id_idx" ON "automation_executions"("flow_id");

-- CreateIndex
CREATE INDEX "automation_executions_executed_at_idx" ON "automation_executions"("executed_at");

-- CreateIndex
CREATE INDEX "automation_executions_status_idx" ON "automation_executions"("status");

-- CreateIndex
CREATE INDEX "integrations_tenant_id_idx" ON "integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE INDEX "integrations_active_idx" ON "integrations"("active");

-- CreateIndex
CREATE INDEX "integration_syncs_integration_id_idx" ON "integration_syncs"("integration_id");

-- CreateIndex
CREATE INDEX "integration_syncs_started_at_idx" ON "integration_syncs"("started_at");

-- CreateIndex
CREATE INDEX "integration_syncs_status_idx" ON "integration_syncs"("status");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_campaign_id_key" ON "business_hours"("campaign_id");

-- CreateIndex
CREATE INDEX "business_hours_tenant_id_idx" ON "business_hours"("tenant_id");

-- CreateIndex
CREATE INDEX "connections_tenant_id_idx" ON "connections"("tenant_id");

-- CreateIndex
CREATE INDEX "connections_status_idx" ON "connections"("status");

-- CreateIndex
CREATE INDEX "interactive_campaigns_connection_id_idx" ON "interactive_campaigns"("connection_id");

-- CreateIndex
CREATE INDEX "interactive_campaigns_tenant_id_idx" ON "interactive_campaigns"("tenant_id");

-- CreateIndex
CREATE INDEX "interactive_campaigns_status_idx" ON "interactive_campaigns"("status");

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

-- CreateIndex
CREATE UNIQUE INDEX "messages_provider_message_id_key" ON "messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "messages_connection_id_idx" ON "messages"("connection_id");

-- CreateIndex
CREATE INDEX "messages_direction_idx" ON "messages"("direction");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_connection_id_idx" ON "webhook_subscriptions"("connection_id");
