-- CreateEnum
CREATE TYPE "WebsiteQuality" AS ENUM ('GOOD', 'AVERAGE', 'POOR', 'UNKNOWN');

-- AlterTable
ALTER TABLE "LeadAiAnalysis" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opportunity" "ScoreLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "scoreReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "websiteQuality" "WebsiteQuality" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "LeadAiAnalysis_score_idx" ON "LeadAiAnalysis"("score");
