-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "availableDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "availableFrom" TEXT,
ADD COLUMN     "availableTo" TEXT;

