-- AlterTable
ALTER TABLE "LeadWebsiteAnalysis" ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "ProspectingList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectingListLead" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectingListLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectingList_slug_key" ON "ProspectingList"("slug");

-- CreateIndex
CREATE INDEX "ProspectingList_updatedAt_idx" ON "ProspectingList"("updatedAt");

-- CreateIndex
CREATE INDEX "ProspectingListLead_leadId_idx" ON "ProspectingListLead"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectingListLead_listId_leadId_key" ON "ProspectingListLead"("listId", "leadId");

-- AddForeignKey
ALTER TABLE "ProspectingListLead" ADD CONSTRAINT "ProspectingListLead_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProspectingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectingListLead" ADD CONSTRAINT "ProspectingListLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

