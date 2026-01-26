-- AlterTable
ALTER TABLE "interactive_campaign_sessions" ADD COLUMN "visited_nodes" JSONB NOT NULL DEFAULT '[]';
