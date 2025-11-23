/*
  Warnings:

  - You are about to drop the column `wordContent` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `DocumentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `wordContent` on the `DocumentVersion` table. All the data in the column will be lost.
  - Added the required column `fileName` to the `DocumentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `googleDriveId` to the `DocumentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `DocumentTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "wordContent";
ALTER TABLE "Document" ADD COLUMN     "fileName" STRING;
ALTER TABLE "Document" ADD COLUMN     "googleDriveId" STRING;
ALTER TABLE "Document" ADD COLUMN     "mimeType" STRING;

-- AlterTable
ALTER TABLE "DocumentTemplate" DROP COLUMN "content";
ALTER TABLE "DocumentTemplate" ADD COLUMN     "fileName" STRING NOT NULL;
ALTER TABLE "DocumentTemplate" ADD COLUMN     "googleDriveId" STRING NOT NULL;
ALTER TABLE "DocumentTemplate" ADD COLUMN     "mimeType" STRING NOT NULL;

-- AlterTable
ALTER TABLE "DocumentVersion" DROP COLUMN "wordContent";
ALTER TABLE "DocumentVersion" ADD COLUMN     "fileName" STRING;
ALTER TABLE "DocumentVersion" ADD COLUMN     "googleDriveId" STRING;
ALTER TABLE "DocumentVersion" ADD COLUMN     "mimeType" STRING;
