-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'AI_ANALYZED';

-- AlterTable
ALTER TABLE "ApiUsage" ADD COLUMN     "costUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "LeadAiAnalysis" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "opportunities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approach" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadAiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadAiAnalysis_leadId_key" ON "LeadAiAnalysis"("leadId");

-- CreateIndex
CREATE INDEX "LeadAiAnalysis_createdAt_idx" ON "LeadAiAnalysis"("createdAt");

-- AddForeignKey
ALTER TABLE "LeadAiAnalysis" ADD CONSTRAINT "LeadAiAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

