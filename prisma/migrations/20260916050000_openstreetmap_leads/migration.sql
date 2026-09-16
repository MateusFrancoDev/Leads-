-- Captação de leads reais via OpenStreetMap: rastreabilidade de contatos,
-- status de WhatsApp/enriquecimento, cache de cidades e funil de CRM.

-- CreateEnum
CREATE TYPE "WhatsappStatus" AS ENUM ('CONFIRMED', 'POSSIBLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterEnum
-- O valor novo só pode ser usado depois do commit desta migration; a
-- conversão dos dados antigos fica na migration seguinte.
ALTER TYPE "WebsiteStatus" ADD VALUE 'NOT_PROVIDED' AFTER 'NO_WEBSITE';

-- AlterEnum
-- RENAME VALUE preserva os leads que já estão nesses estágios.
ALTER TYPE "LeadStatus" ADD VALUE 'PROPOSAL_SENT' BEFORE 'CUSTOMER';
ALTER TYPE "LeadStatus" RENAME VALUE 'CUSTOMER' TO 'CLIENT';
ALTER TYPE "LeadStatus" RENAME VALUE 'NOT_INTERESTED' TO 'DISCARDED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "emailSource" TEXT,
ADD COLUMN     "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "instagramSource" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "phoneSource" TEXT,
ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "websiteSource" TEXT,
ADD COLUMN     "whatsappSource" TEXT,
ADD COLUMN     "whatsappStatus" "WhatsappStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "fetchLimit" INTEGER,
ADD COLUMN     "rawCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LocationCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "osmType" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "south" DOUBLE PRECISION NOT NULL,
    "north" DOUBLE PRECISION NOT NULL,
    "west" DOUBLE PRECISION NOT NULL,
    "east" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_key_key" ON "LocationCache"("key");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_websiteDomain_idx" ON "Lead"("websiteDomain");

-- Data
-- Todo WhatsApp gravado até aqui foi deduzido de um celular, nunca confirmado.
-- O número continua disponível em "phone"; o lead passa a ser "possível".
UPDATE "Lead" SET "whatsappStatus" = 'POSSIBLE', "whatsapp" = NULL WHERE "whatsapp" IS NOT NULL;

-- Contatos já existentes vieram da fonte que descobriu o lead.
UPDATE "Lead" SET "phoneSource" = "provider" WHERE "phone" IS NOT NULL;
UPDATE "Lead" SET "websiteSource" = "provider" WHERE "website" IS NOT NULL;

-- As buscas antigas usavam outro formato de chave e outra fonte: expiram já.
UPDATE "Search" SET "expiresAt" = CURRENT_TIMESTAMP WHERE "expiresAt" > CURRENT_TIMESTAMP;
