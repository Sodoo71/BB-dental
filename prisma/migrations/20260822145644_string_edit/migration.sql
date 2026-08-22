/*
  Warnings:

  - Made the column `price` on table `Service` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "durationMin" DROP DEFAULT,
ALTER COLUMN "durationMin" SET DATA TYPE TEXT,
ALTER COLUMN "price" SET NOT NULL,
ALTER COLUMN "price" SET DATA TYPE TEXT;
