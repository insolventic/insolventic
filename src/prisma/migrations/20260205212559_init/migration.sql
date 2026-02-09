-- CreateEnum
CREATE TYPE "crdb_internal_region" AS ENUM ('aws-us-east-1');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "totalDebt" DECIMAL(65,30) NOT NULL,
    "creditors" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hearingDate" TIMESTAMP(3),
    "phase" TEXT,
    "causes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "debtorId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tramite" TEXT,
    "filingDate" TIMESTAMP(3),
    "debtorIdNumber" TEXT,
    "convened" TEXT,
    "attorney" TEXT,
    "owedCapital" DECIMAL(65,30),
    "designatedOperator" TEXT,
    "designationDate" TIMESTAMP(3),
    "positionAcceptanceDate" TIMESTAMP(3),
    "inadmissionDate" TIMESTAMP(3),
    "admissionDate" TIMESTAMP(3),
    "firstHearingDate" TIMESTAMP(3),
    "firstHearingTime" TEXT,
    "rejection" BOOLEAN NOT NULL DEFAULT false,
    "withdrawal" BOOLEAN NOT NULL DEFAULT false,
    "hasLegalProcesses" BOOLEAN NOT NULL DEFAULT false,
    "courtNumber" TEXT,
    "city" TEXT,
    "processType" TEXT,
    "plaintiff" TEXT,
    "judicialFileNumber" TEXT,
    "suspensionDate" TIMESTAMP(3),
    "resultDeliveryDate" TIMESTAMP(3),
    "resultType" TEXT,
    "resultDate" TIMESTAMP(3),
    "siccacNumber" TEXT,
    "riskCenterCommunication" BOOLEAN NOT NULL DEFAULT false,
    "applicantScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gracePeriodRequested" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodMonths" INTEGER,
    "paymentInKind" BOOLEAN NOT NULL DEFAULT false,
    "paymentInKindDescription" TEXT,
    "assetSaleAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "assetSaleDescription" TEXT,
    "cashFlowPayment" BOOLEAN NOT NULL DEFAULT false,
    "paymentTermMonths" INTEGER,
    "monthlyPaymentAmount" DECIMAL(65,30),
    "variablePayment" DECIMAL(65,30),
    "extraordinaryPayment" BOOLEAN NOT NULL DEFAULT false,
    "extraordinaryPaymentDate" TEXT,
    "capitalReduction" BOOLEAN NOT NULL DEFAULT false,
    "capitalReductionPercent" DECIMAL(65,30),
    "insuranceOffering" TEXT,
    "forgiveAccruedInterest" BOOLEAN NOT NULL DEFAULT false,
    "forgiveFutureInterest" BOOLEAN NOT NULL DEFAULT false,
    "paymentOrder" JSONB,
    "hasClassPrivileges" BOOLEAN NOT NULL DEFAULT false,
    "classPrivilegesDescription" TEXT,
    "thirdPartyPaymentAuth" BOOLEAN NOT NULL DEFAULT false,
    "guaranteeSubstitution" BOOLEAN NOT NULL DEFAULT false,
    "spouseName" TEXT,
    "spouseIdNumber" TEXT,
    "spouseAddress" TEXT,
    "spousePhone" TEXT,
    "spouseEmail" TEXT,
    "requestedFee" TEXT,
    "legalFoundations" TEXT,
    "notificationAddress" TEXT,
    "notificationPhone" TEXT,
    "notificationEmail" TEXT,
    "applicantSignatureName" TEXT,
    "applicantSignatureId" TEXT,
    "applicantSignature" TEXT,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "googleDriveId" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "isGenerated" BOOLEAN NOT NULL DEFAULT false,
    "templateFolderPath" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "googleDriveId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "placeholders" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "folderPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentFolderId" TEXT,
    "isFolder" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFromDrive" (
    "id" TEXT NOT NULL,
    "googleDriveId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "folderPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentFolderId" TEXT,
    "isFolder" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DocumentFromDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debtor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "maritalStatus" TEXT,
    "occupation" TEXT NOT NULL,
    "monthlyIncome" DECIMAL(65,30) NOT NULL,
    "monthlyExpenses" DECIMAL(65,30),
    "dependents" INTEGER,
    "educationLevel" TEXT,
    "totalDebt" DECIMAL(65,30) NOT NULL,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "accountType" TEXT,
    "description" TEXT,
    "activeCases" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdate" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "otherIncomeDescription" TEXT,
    "otherIncomeAmount" DECIMAL(65,30),
    "hasEmployerCertification" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "debtorId" TEXT,
    "tenantId" TEXT NOT NULL,
    "creditorAddress" TEXT,
    "creditorCity" TEXT,
    "creditorEmail" TEXT,
    "capitalAmount" DECIMAL(65,30),
    "interestAmount" DECIMAL(65,30),
    "isDeferred" BOOLEAN NOT NULL DEFAULT false,
    "documentType" TEXT,
    "grantDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "creditClassification" TEXT,
    "hasActiveLibranza" BOOLEAN NOT NULL DEFAULT false,
    "creditorClass" TEXT,
    "percentageOfTotal" DECIMAL(65,30),
    "daysOverdue" INTEGER,
    "coDebtorName" TEXT,
    "coDebtorCity" TEXT,
    "coDebtorAddress" TEXT,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "caseId" TEXT NOT NULL,
    "debtorId" TEXT,
    "tenantId" TEXT NOT NULL,
    "propertyType" TEXT,
    "address" TEXT,
    "registrationNumber" TEXT,
    "encumbrance" TEXT,
    "affectation" TEXT,
    "precautionaryMeasure" TEXT,
    "proofDocument" TEXT,
    "isFamilyHome" BOOLEAN NOT NULL DEFAULT false,
    "isInalienablePatrimony" BOOLEAN NOT NULL DEFAULT false,
    "brand" TEXT,
    "model" TEXT,
    "condition" TEXT,
    "licensePlate" TEXT,
    "transitAuthority" TEXT,
    "guaranteeInFavorOf" TEXT,
    "guaranteeAmount" DECIMAL(65,30),
    "material" TEXT,
    "description" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creditor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "website" TEXT,
    "city" TEXT,
    "department" TEXT,
    "bankName" TEXT,
    "createdDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastUpdate" TIMESTAMP(3),
    "description" TEXT,
    "representativeId" TEXT,
    "representativeEmail" TEXT,
    "representativePhone" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Creditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalProcess" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "processType" TEXT,
    "plaintiff" TEXT,
    "court" TEXT,
    "fileNumber" TEXT,
    "precautionaryMeasure" TEXT,

    CONSTRAINT "LegalProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "professionalCard" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" TEXT NOT NULL,
    "password" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "relatedId" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Libranza" (
    "id" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerAddress" TEXT,
    "payerEmail" TEXT,
    "payerPhone" TEXT,
    "deductedAmount" DECIMAL(65,30) NOT NULL,
    "productAndCreditor" TEXT,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Libranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspendedService" (
    "id" TEXT NOT NULL,
    "creditorName" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "suspendedProduct" TEXT,
    "amountOwed" DECIMAL(65,30) NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SuspendedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "relationship" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_tenantId_key" ON "Case"("caseNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFromDrive_googleDriveId_tenantId_key" ON "DocumentFromDrive"("googleDriveId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_idNumber_tenantId_key" ON "Debtor"("idNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_email_tenantId_key" ON "Debtor"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_email_tenantId_key" ON "Creditor"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_nit_tenantId_key" ON "Creditor"("nit", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_tenantId_key" ON "Role"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_tenantId_key" ON "Permission"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFromDrive" ADD CONSTRAINT "DocumentFromDrive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creditor" ADD CONSTRAINT "Creditor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Libranza" ADD CONSTRAINT "Libranza_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Libranza" ADD CONSTRAINT "Libranza_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspendedService" ADD CONSTRAINT "SuspendedService_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspendedService" ADD CONSTRAINT "SuspendedService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
