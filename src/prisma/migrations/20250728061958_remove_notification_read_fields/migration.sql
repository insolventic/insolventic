/*
  Warnings:

  - You are about to drop the column `read` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `readDate` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "read";
ALTER TABLE "notifications" DROP COLUMN "readDate";
