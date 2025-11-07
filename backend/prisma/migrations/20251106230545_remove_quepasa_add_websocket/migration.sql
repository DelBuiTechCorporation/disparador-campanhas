-- Remove QuePasa provider from WhatsAppProvider enum
ALTER TYPE "WhatsAppProvider" RENAME TO "WhatsAppProvider_old";
CREATE TYPE "WhatsAppProvider" AS ENUM ('WAHA', 'EVOLUTION');
ALTER TABLE "WhatsAppSession" ALTER COLUMN "provider" TYPE "WhatsAppProvider" USING "provider"::text::"WhatsAppProvider";
DROP TYPE "WhatsAppProvider_old";

-- Remove quepasa fields from GlobalSettings
ALTER TABLE "GlobalSettings" DROP COLUMN IF EXISTS "quepasaUrl";
ALTER TABLE "GlobalSettings" DROP COLUMN IF EXISTS "quepasaLogin";
ALTER TABLE "GlobalSettings" DROP COLUMN IF EXISTS "quepasaPassword";

-- Remove quepasaToken from WhatsAppSession
ALTER TABLE "WhatsAppSession" DROP COLUMN IF EXISTS "quepasaToken";
