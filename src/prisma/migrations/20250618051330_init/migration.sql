-- CreateTable
CREATE TABLE "Case" (
    "id" STRING NOT NULL,
    "caseNumber" STRING NOT NULL,
    "debtorName" STRING NOT NULL,
    "type" STRING NOT NULL,
    "status" STRING NOT NULL,
    "totalDebt" DECIMAL(65,30) NOT NULL,
    "creditors" INT4 NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hearingDate" TIMESTAMP(3),
    "phase" STRING,
    "debtorId" STRING NOT NULL,
    "operatorId" STRING NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "type" STRING NOT NULL,
    "status" STRING NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" STRING NOT NULL,
    "caseId" STRING NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debtor" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "idNumber" STRING NOT NULL,
    "idType" STRING NOT NULL,
    "email" STRING NOT NULL,
    "phone" STRING NOT NULL,
    "address" STRING NOT NULL,
    "city" STRING NOT NULL,
    "department" STRING NOT NULL,
    "birthDate" TIMESTAMP(3),
    "maritalStatus" STRING,
    "occupation" STRING NOT NULL,
    "monthlyIncome" DECIMAL(65,30) NOT NULL,
    "monthlyExpenses" DECIMAL(65,30),
    "dependents" INT4,
    "educationLevel" STRING,
    "totalDebt" DECIMAL(65,30) NOT NULL,
    "status" STRING NOT NULL,
    "emergencyContact" STRING,
    "emergencyPhone" STRING,
    "bankAccount" STRING,
    "bankName" STRING,
    "accountType" STRING,
    "description" STRING,
    "activeCases" INT4 NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" STRING NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "interestRate" FLOAT8 NOT NULL,
    "type" STRING NOT NULL,
    "caseId" STRING NOT NULL,
    "creditorId" STRING NOT NULL,
    "debtorId" STRING,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "type" STRING NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "caseId" STRING NOT NULL,
    "debtorId" STRING,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creditor" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "type" STRING NOT NULL,
    "email" STRING NOT NULL,
    "phone" STRING NOT NULL,
    "address" STRING NOT NULL,
    "status" STRING NOT NULL,
    "representative" STRING NOT NULL,
    "nit" STRING NOT NULL,
    "website" STRING,
    "city" STRING,
    "department" STRING,
    "bankName" STRING,
    "activeCases" INT4 NOT NULL DEFAULT 0,
    "createdDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastUpdate" TIMESTAMP(3),
    "description" STRING,
    "representativeId" STRING,
    "representativeEmail" STRING,
    "representativePhone" STRING,

    CONSTRAINT "Creditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "role" STRING NOT NULL,
    "email" STRING NOT NULL,
    "phone" STRING NOT NULL,
    "creditorId" STRING NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalProcess" (
    "id" STRING NOT NULL,
    "description" STRING NOT NULL,
    "caseId" STRING NOT NULL,

    CONSTRAINT "LegalProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING NOT NULL,
    "status" STRING NOT NULL DEFAULT 'Activo',
    "lastLogin" TIMESTAMP(3),
    "professionalCard" STRING NOT NULL,
    "phone" STRING NOT NULL,
    "address" STRING NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" STRING NOT NULL,
    "password" STRING,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "description" STRING NOT NULL,
    "permissions" STRING[],
    "color" STRING NOT NULL DEFAULT 'bg-gray-100 text-gray-800',

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" STRING NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" STRING NOT NULL,
    "userId" STRING NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_idNumber_key" ON "Debtor"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_email_key" ON "Debtor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_email_key" ON "Creditor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creditor_nit_key" ON "Creditor"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
