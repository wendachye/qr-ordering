-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
