-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_campaign_id_key" ON "business_hours"("campaign_id");

-- CreateIndex
CREATE INDEX "business_hours_tenant_id_idx" ON "business_hours"("tenant_id");

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;