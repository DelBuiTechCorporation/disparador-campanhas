-- Remove EVOLUTION from WhatsAppProvider enum, keep only WAHA
ALTER TYPE "WhatsAppProvider" RENAME TO "WhatsAppProvider_old";
CREATE TYPE "WhatsAppProvider" AS ENUM ('WAHA');
ALTER TABLE "WhatsAppSession" ALTER COLUMN "provider" TYPE "WhatsAppProvider" USING "provider"::text::"WhatsAppProvider";
DROP TYPE "WhatsAppProvider_old";

-- Remove evolution fields from GlobalSettings
ALTER TABLE "GlobalSettings" DROP COLUMN IF EXISTS "evolutionHost";
ALTER TABLE "GlobalSettings" DROP COLUMN IF EXISTS "evolutionApiKey";
