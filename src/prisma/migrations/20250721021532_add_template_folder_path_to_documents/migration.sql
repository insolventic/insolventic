-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "templateFolderPath" STRING[] DEFAULT ARRAY[]::STRING[];
