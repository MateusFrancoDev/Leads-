-- Dados Abertos do CNPJ (Receita Federal) como segunda fonte de empresas
-- reais, e busca com cidades vizinhas.

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "extraCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceCounts" JSONB,
ADD COLUMN     "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CnpjEstablishment" (
    "cnpj" TEXT NOT NULL,
    "cnpjBase" TEXT NOT NULL,
    "tradeName" TEXT,
    "companyName" TEXT,
    "cnaeMain" TEXT NOT NULL,
    "isHeadquarters" BOOLEAN NOT NULL,
    "streetType" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "postalCode" TEXT,
    "state" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "phone1" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "startDate" TEXT,
    "datasetMonth" TEXT NOT NULL,

    CONSTRAINT "CnpjEstablishment_pkey" PRIMARY KEY ("cnpj")
);

-- CreateTable
CREATE TABLE "CnpjImportedCity" (
    "key" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "datasetMonth" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CnpjImportedCity_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CnpjEstablishment_state_cityName_cnaeMain_idx" ON "CnpjEstablishment"("state", "cityName", "cnaeMain");

-- As buscas em cache antigas só consultaram o OpenStreetMap: expiram para
-- incluir a nova fonte na próxima execução.
UPDATE "Search" SET "expiresAt" = CURRENT_TIMESTAMP WHERE "expiresAt" > CURRENT_TIMESTAMP;
