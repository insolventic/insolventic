/*
  Warnings:

  - The `convened` column on the `Case` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Case" DROP COLUMN "convened";
ALTER TABLE "Case" ADD COLUMN     "convened" STRING;
