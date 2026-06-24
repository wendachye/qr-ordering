-- DropForeignKey
ALTER TABLE "Store" DROP CONSTRAINT "Store_catalogueId_fkey";

-- AlterTable
ALTER TABLE "Store" ALTER COLUMN "catalogueId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

