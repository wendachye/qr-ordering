-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "featuredOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "featuredTitle" TEXT NOT NULL DEFAULT 'Popular';

-- CreateIndex
CREATE INDEX "MenuItem_storeId_isFeatured_idx" ON "MenuItem"("storeId", "isFeatured");
