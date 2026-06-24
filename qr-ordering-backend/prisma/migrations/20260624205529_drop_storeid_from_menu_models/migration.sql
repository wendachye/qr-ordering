-- DropForeignKey
ALTER TABLE "Combo" DROP CONSTRAINT "Combo_catalogueId_fkey";

-- DropForeignKey
ALTER TABLE "Combo" DROP CONSTRAINT "Combo_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_catalogueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_catalogueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_storeId_fkey";

-- DropIndex
DROP INDEX "Combo_storeId_idx";

-- DropIndex
DROP INDEX "MenuCategory_storeId_idx";

-- DropIndex
DROP INDEX "MenuItem_storeId_idx";

-- DropIndex
DROP INDEX "MenuItem_storeId_isFeatured_idx";

-- AlterTable
ALTER TABLE "Combo" DROP COLUMN "storeId",
ALTER COLUMN "catalogueId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MenuCategory" DROP COLUMN "storeId",
ALTER COLUMN "catalogueId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "storeId",
ALTER COLUMN "catalogueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "MenuItem_catalogueId_isFeatured_idx" ON "MenuItem"("catalogueId", "isFeatured");

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

