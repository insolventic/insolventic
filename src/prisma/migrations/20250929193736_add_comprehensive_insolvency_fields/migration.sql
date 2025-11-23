-- AlterTable
ALTER TABLE "public"."Asset" ADD COLUMN     "address" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "affectation" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "brand" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "condition" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "description" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "encumbrance" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "guaranteeAmount" DECIMAL(65,30);
ALTER TABLE "public"."Asset" ADD COLUMN     "guaranteeInFavorOf" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "isFamilyHome" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Asset" ADD COLUMN     "isInalienablePatrimony" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Asset" ADD COLUMN     "licensePlate" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "material" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "model" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "precautionaryMeasure" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "proofDocument" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "propertyType" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "registrationNumber" STRING;
ALTER TABLE "public"."Asset" ADD COLUMN     "transitAuthority" STRING;

-- AlterTable
ALTER TABLE "public"."Case" ADD COLUMN     "applicantScope" STRING[] DEFAULT ARRAY[]::STRING[];
ALTER TABLE "public"."Case" ADD COLUMN     "applicantSignature" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "applicantSignatureId" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "applicantSignatureName" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "assetSaleAuthorized" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "assetSaleDescription" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "capitalReduction" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "capitalReductionPercent" DECIMAL(65,30);
ALTER TABLE "public"."Case" ADD COLUMN     "cashFlowPayment" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "classPrivilegesDescription" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "extraordinaryPayment" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "extraordinaryPaymentDate" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "forgiveAccruedInterest" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "forgiveFutureInterest" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "gracePeriodMonths" INT4;
ALTER TABLE "public"."Case" ADD COLUMN     "gracePeriodRequested" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "guaranteeSubstitution" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "hasClassPrivileges" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "insuranceOffering" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "legalFoundations" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "monthlyPaymentAmount" DECIMAL(65,30);
ALTER TABLE "public"."Case" ADD COLUMN     "notificationAddress" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "notificationEmail" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "notificationPhone" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "paymentInKind" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "paymentInKindDescription" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "paymentOrder" JSONB;
ALTER TABLE "public"."Case" ADD COLUMN     "paymentTermMonths" INT4;
ALTER TABLE "public"."Case" ADD COLUMN     "requestedFee" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "spouseAddress" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "spouseEmail" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "spouseIdNumber" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "spouseName" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "spousePhone" STRING;
ALTER TABLE "public"."Case" ADD COLUMN     "thirdPartyPaymentAuth" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Case" ADD COLUMN     "variablePayment" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Debt" ADD COLUMN     "capitalAmount" DECIMAL(65,30);
ALTER TABLE "public"."Debt" ADD COLUMN     "coDebtorAddress" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "coDebtorCity" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "coDebtorName" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "creditClassification" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "creditorAddress" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "creditorCity" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "creditorClass" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "creditorEmail" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "daysOverdue" INT4;
ALTER TABLE "public"."Debt" ADD COLUMN     "documentType" STRING;
ALTER TABLE "public"."Debt" ADD COLUMN     "dueDate" TIMESTAMP(3);
ALTER TABLE "public"."Debt" ADD COLUMN     "grantDate" TIMESTAMP(3);
ALTER TABLE "public"."Debt" ADD COLUMN     "hasActiveLibranza" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Debt" ADD COLUMN     "interestAmount" DECIMAL(65,30);
ALTER TABLE "public"."Debt" ADD COLUMN     "isDeferred" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Debt" ADD COLUMN     "percentageOfTotal" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Debtor" ADD COLUMN     "hasEmployerCertification" BOOL NOT NULL DEFAULT false;
ALTER TABLE "public"."Debtor" ADD COLUMN     "otherIncomeAmount" DECIMAL(65,30);
ALTER TABLE "public"."Debtor" ADD COLUMN     "otherIncomeDescription" STRING;

-- AlterTable
ALTER TABLE "public"."LegalProcess" ADD COLUMN     "court" STRING;
ALTER TABLE "public"."LegalProcess" ADD COLUMN     "fileNumber" STRING;
ALTER TABLE "public"."LegalProcess" ADD COLUMN     "plaintiff" STRING;
ALTER TABLE "public"."LegalProcess" ADD COLUMN     "precautionaryMeasure" STRING;
ALTER TABLE "public"."LegalProcess" ADD COLUMN     "processType" STRING;

-- CreateTable
CREATE TABLE "public"."Libranza" (
    "id" STRING NOT NULL,
    "payerName" STRING NOT NULL,
    "payerAddress" STRING,
    "payerEmail" STRING,
    "payerPhone" STRING,
    "deductedAmount" DECIMAL(65,30) NOT NULL,
    "productAndCreditor" STRING,
    "caseId" STRING NOT NULL,
    "tenantId" STRING NOT NULL,

    CONSTRAINT "Libranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SuspendedService" (
    "id" STRING NOT NULL,
    "creditorName" STRING NOT NULL,
    "address" STRING,
    "email" STRING,
    "phone" STRING,
    "suspendedProduct" STRING,
    "amountOwed" DECIMAL(65,30) NOT NULL,
    "caseId" STRING NOT NULL,
    "tenantId" STRING NOT NULL,

    CONSTRAINT "SuspendedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dependent" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "age" INT4 NOT NULL,
    "relationship" STRING NOT NULL,
    "caseId" STRING NOT NULL,
    "tenantId" STRING NOT NULL,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Libranza" ADD CONSTRAINT "Libranza_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Libranza" ADD CONSTRAINT "Libranza_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SuspendedService" ADD CONSTRAINT "SuspendedService_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SuspendedService" ADD CONSTRAINT "SuspendedService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dependent" ADD CONSTRAINT "Dependent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dependent" ADD CONSTRAINT "Dependent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
