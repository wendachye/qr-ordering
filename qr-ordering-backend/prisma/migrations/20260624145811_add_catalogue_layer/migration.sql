-- AlterTable
ALTER TABLE "Combo" ADD COLUMN     "catalogueId" TEXT;

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "catalogueId" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "catalogueId" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "catalogueId" TEXT;

-- CreateTable
CREATE TABLE "Catalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Catalogue_clientId_idx" ON "Catalogue"("clientId");

-- CreateIndex
CREATE INDEX "Combo_catalogueId_idx" ON "Combo"("catalogueId");

-- CreateIndex
CREATE INDEX "MenuCategory_catalogueId_idx" ON "MenuCategory"("catalogueId");

-- CreateIndex
CREATE INDEX "MenuItem_catalogueId_idx" ON "MenuItem"("catalogueId");

-- CreateIndex
CREATE INDEX "Store_catalogueId_idx" ON "Store"("catalogueId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Catalogue" ADD CONSTRAINT "Catalogue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ----------------------------------------------------------------------------
-- Phase 1 (expand) backfill: give every existing store its own 1:1 catalogue and
-- link its menu (categories / items / combos). Behaviour is unchanged — nothing
-- reads catalogueId yet. A later phase points a brand's sibling outlets at one
-- shared catalogue and drops the per-store storeId from the menu models.
-- ----------------------------------------------------------------------------
INSERT INTO "Catalogue" ("id", "name", "clientId", "createdAt", "updatedAt")
SELECT 'cat_' || "id", "name", "clientId", now(), now() FROM "Store";

UPDATE "Store"        SET "catalogueId" = 'cat_' || "id";
UPDATE "MenuCategory" SET "catalogueId" = 'cat_' || "storeId";
UPDATE "MenuItem"     SET "catalogueId" = 'cat_' || "storeId";
UPDATE "Combo"        SET "catalogueId" = 'cat_' || "storeId";
