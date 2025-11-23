/*
  Warnings:

  - You are about to drop the column `category` on the `DocumentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `DocumentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `DocumentTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DocumentTemplate" DROP COLUMN "category";
ALTER TABLE "DocumentTemplate" DROP COLUMN "description";
ALTER TABLE "DocumentTemplate" DROP COLUMN "name";
