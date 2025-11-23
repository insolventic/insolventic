-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "folderPath" STRING[] DEFAULT ARRAY[]::STRING[];
ALTER TABLE "DocumentTemplate" ADD COLUMN     "isFolder" BOOL NOT NULL DEFAULT false;
ALTER TABLE "DocumentTemplate" ADD COLUMN     "parentFolderId" STRING;
