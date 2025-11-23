-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "causes" STRING[] DEFAULT ARRAY[]::STRING[];
