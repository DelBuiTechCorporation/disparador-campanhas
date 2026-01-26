-- UpdateInteractiveCampaignStatus
-- Atualiza status de PUBLISHED para STARTED nas campanhas já publicadas
UPDATE "interactive_campaigns" SET "status" = 'STARTED' WHERE "status" = 'PUBLISHED';
