/*
  Warnings:

  - You are about to drop the column `content` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the `DocumentVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_documentId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "content";
ALTER TABLE "Document" DROP COLUMN "version";

-- DropTable
DROP TABLE "DocumentVersion";
