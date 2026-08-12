-- CreateTable
CREATE TABLE "document_generation_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activeKey" TEXT,
    "requestedById" TEXT,
    "error" TEXT,
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "document_generation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_generation_requests_tenantId_caseId_createdAt_idx" ON "document_generation_requests"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_generation_requests_activeKey_key" ON "document_generation_requests"("activeKey");

-- AddForeignKey
ALTER TABLE "document_generation_requests" ADD CONSTRAINT "document_generation_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_generation_requests" ADD CONSTRAINT "document_generation_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

