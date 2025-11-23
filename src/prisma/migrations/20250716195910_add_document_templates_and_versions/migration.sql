-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "content" STRING;
ALTER TABLE "Document" ADD COLUMN     "isGenerated" BOOL NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN     "templateId" STRING;
ALTER TABLE "Document" ADD COLUMN     "version" INT4 NOT NULL DEFAULT 1;
ALTER TABLE "Document" ADD COLUMN     "wordContent" BYTES;

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "description" STRING,
    "category" STRING NOT NULL,
    "content" BYTES NOT NULL,
    "placeholders" JSONB NOT NULL,
    "isActive" BOOL NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" STRING NOT NULL,
    "documentId" STRING NOT NULL,
    "version" INT4 NOT NULL,
    "content" STRING,
    "wordContent" BYTES,
    "changes" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" STRING NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
