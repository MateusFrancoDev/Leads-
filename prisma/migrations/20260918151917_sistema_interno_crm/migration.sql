-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTNER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('LEAD', 'NEGOTIATING', 'ACTIVE', 'COMPLETED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('LANDING_PAGE', 'INSTITUTIONAL_SITE', 'ECOMMERCE', 'SAAS', 'APP', 'MAINTENANCE', 'CONSULTING', 'AUTOMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('QUOTE', 'AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'PLANNING', 'DEVELOPMENT', 'REVIEW', 'AWAITING_CLIENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('DOMAIN', 'HOSTING', 'API', 'DATABASE', 'DESIGNER', 'FREELANCER', 'LICENSE', 'SOFTWARE', 'TOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('BRIEFING', 'CONTRACT', 'DESIGN', 'LOGO', 'CONTENT', 'DEVELOPMENT', 'FINANCE', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('NOT_SENT', 'SENT', 'SIGNED');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'PROGRESS_CHANGED', 'DEADLINE_CHANGED', 'PAYMENT_REGISTERED', 'PAYMENT_RECEIVED', 'EXPENSE_REGISTERED', 'FILE_ADDED', 'FILE_REMOVED', 'NOTE_ADDED', 'TASK_COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityEntity" AS ENUM ('CLIENT', 'PROJECT', 'TASK', 'PAYMENT', 'EXPENSE', 'NOTE', 'FILE', 'EVENT', 'USER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEETING', 'DELIVERY', 'REMINDER', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PARTNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "document" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'LEAD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'QUOTE',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectUrl" TEXT,
    "repositoryUrl" TEXT,
    "notes" TEXT,
    "contractStatus" "ContractStatus" NOT NULL DEFAULT 'NOT_SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "references" TEXT,
    "colors" TEXT,
    "style" TEXT,
    "features" TEXT,
    "competitors" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amountCents" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "category" "FileCategory" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "entityType" "ActivityEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'MEETING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "companyName" TEXT NOT NULL DEFAULT 'Lummit',
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_deadline_idx" ON "Project"("deadline");

-- CreateIndex
CREATE INDEX "Project_priority_idx" ON "Project"("priority");

-- CreateIndex
CREATE INDEX "Project_type_idx" ON "Project"("type");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_projectId_key" ON "Briefing"("projectId");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_assignedUserId_status_idx" ON "Task"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");

-- CreateIndex
CREATE INDEX "Task_status_position_idx" ON "Task"("status", "position");

-- CreateIndex
CREATE INDEX "Payment_projectId_idx" ON "Payment"("projectId");

-- CreateIndex
CREATE INDEX "Payment_status_dueDate_idx" ON "Payment"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Note_projectId_createdAt_idx" ON "Note"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_clientId_createdAt_idx" ON "Note"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_projectId_createdAt_idx" ON "StoredFile"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_clientId_createdAt_idx" ON "StoredFile"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_category_idx" ON "StoredFile"("category");

-- CreateIndex
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_entityType_entityId_idx" ON "Activity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_startsAt_idx" ON "CalendarEvent"("startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
