-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('HAS_WEBSITE', 'NO_WEBSITE', 'INVALID_WEBSITE', 'UNREACHABLE_WEBSITE', 'SOCIAL_ONLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'RESPONDED', 'INTERESTED', 'CUSTOMER', 'NOT_INTERESTED', 'INVALID');

-- CreateEnum
CREATE TYPE "ScoreLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('DISCOVERED', 'STATUS_CHANGED', 'ENRICHED', 'WEBSITE_ANALYZED', 'NOTE');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "websiteDomain" TEXT,
    "websiteStatus" "WebsiteStatus" NOT NULL DEFAULT 'UNKNOWN',
    "instagram" TEXT,
    "facebook" TEXT,
    "linkedin" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewsCount" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreLevel" "ScoreLevel" NOT NULL DEFAULT 'LOW',
    "scoreReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "enrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "keyword" TEXT,
    "city" TEXT,
    "state" TEXT,
    "neighborhood" TEXT,
    "country" TEXT,
    "radiusMeters" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "provider" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "runCount" INTEGER NOT NULL DEFAULT 1,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadWebsiteAnalysis" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "hasHttps" BOOLEAN,
    "hasViewport" BOOLEAN,
    "hasTitle" BOOLEAN,
    "hasDescription" BOOLEAN,
    "hasFavicon" BOOLEAN,
    "hasContactForm" BOOLEAN,
    "hasPhone" BOOLEAN,
    "hasWhatsapp" BOOLEAN,
    "hasAnalytics" BOOLEAN,
    "hasMetaPixel" BOOLEAN,
    "contentHash" TEXT,
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadWebsiteAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 1,
    "items" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_city_state_idx" ON "Lead"("city", "state");

-- CreateIndex
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

-- CreateIndex
CREATE INDEX "Lead_score_idx" ON "Lead"("score");

-- CreateIndex
CREATE INDEX "Lead_websiteStatus_idx" ON "Lead"("websiteStatus");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_isFavorite_idx" ON "Lead"("isFavorite");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_provider_externalId_key" ON "Lead"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_dedupeKey_key" ON "Lead"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Search_cacheKey_key" ON "Search"("cacheKey");

-- CreateIndex
CREATE INDEX "Search_lastRunAt_idx" ON "Search"("lastRunAt");

-- CreateIndex
CREATE INDEX "Search_expiresAt_idx" ON "Search"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchResult_leadId_idx" ON "SearchResult"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchResult_searchId_leadId_key" ON "SearchResult"("searchId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadWebsiteAnalysis_leadId_key" ON "LeadWebsiteAnalysis"("leadId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_provider_operation_createdAt_idx" ON "ApiUsage"("provider", "operation", "createdAt");

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadWebsiteAnalysis" ADD CONSTRAINT "LeadWebsiteAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
