-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "min_random_delay" INTEGER NOT NULL DEFAULT 0;

-- UpdateData: Set existing campaigns to have minRandomDelay = 0
UPDATE "campaigns" SET "min_random_delay" = 0 WHERE "min_random_delay" IS NULL;
