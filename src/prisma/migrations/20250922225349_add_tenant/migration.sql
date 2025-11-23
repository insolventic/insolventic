/*
  Warnings:

  - A unique constraint covering the columns `[caseNumber,tenantId]` on the table `Case` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tenantId]` on the table `Creditor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nit,tenantId]` on the table `Creditor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idNumber,tenantId]` on the table `Debtor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tenantId]` on the table `Debtor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleDriveId,tenantId]` on the table `DocumentFromDrive` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tenantId]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tenantId]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tenantId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Case` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Creditor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Debt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Debtor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `DocumentFromDrive` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `DocumentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `LegalProcess` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Permission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `RolePermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Case_caseNumber_key";

-- DropIndex
DROP INDEX "Creditor_email_key";

-- DropIndex
DROP INDEX "Creditor_nit_key";

-- DropIndex
DROP INDEX "Debtor_email_key";

-- DropIndex
DROP INDEX "Debtor_idNumber_key";

-- DropIndex
DROP INDEX "DocumentFromDrive_googleDriveId_key";

-- DropIndex
DROP INDEX "Permission_name_key";

-- DropIndex
DROP INDEX "Role_name_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Creditor" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Debtor" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "DocumentFromDrive" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "LegalProcess" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" STRING NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenantId" STRING NOT NULL;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "slug" STRING NOT NULL,
    "description" STRING,
    "logoUrl" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" STRING NOT NULL,
    "email" STRING NOT NULL,
    "token" STRING NOT NULL,
    "tenantId" STRING NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOL NOT NULL DEFAULT false,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_tenantId_key" ON "Case"("caseNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_email_tenantId_key" ON "Creditor"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_nit_tenantId_key" ON "Creditor"("nit", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_idNumber_tenantId_key" ON "Debtor"("idNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_email_tenantId_key" ON "Debtor"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFromDrive_googleDriveId_tenantId_key" ON "DocumentFromDrive"("googleDriveId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_tenantId_key" ON "Permission"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_tenantId_key" ON "Role"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFromDrive" ADD CONSTRAINT "DocumentFromDrive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creditor" ADD CONSTRAINT "Creditor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
