-- Move per-item inventory (trackStock / stockQty / lowStockThreshold) off the
-- shared catalogue item (MenuItem) onto the per-outlet MenuItemOutletState, so a
-- brand's outlets each track their own stock. Order matters: add the new columns,
-- copy the existing values across (1:1 — each MenuItem.storeId is its outlet),
-- THEN drop the old columns.

-- 1) Add the per-outlet inventory columns.
ALTER TABLE "MenuItemOutletState" ADD COLUMN     "lowStockThreshold" INTEGER,
ADD COLUMN     "stockQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- 2) Backfill: copy each item's current stock onto its (1:1) outlet's state row.
-- Only items that carry stock data are moved. If an override row already exists
-- for the (outlet, item), update it in place rather than inserting a duplicate.
INSERT INTO "MenuItemOutletState"
  ("id", "storeId", "menuItemId", "trackStock", "stockQty", "lowStockThreshold", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, mi."storeId", mi."id", mi."trackStock", mi."stockQty", mi."lowStockThreshold", NOW(), NOW()
FROM "MenuItem" mi
WHERE mi."trackStock" = true OR mi."stockQty" <> 0 OR mi."lowStockThreshold" IS NOT NULL
ON CONFLICT ("storeId", "menuItemId") DO UPDATE
  SET "trackStock" = EXCLUDED."trackStock",
      "stockQty" = EXCLUDED."stockQty",
      "lowStockThreshold" = EXCLUDED."lowStockThreshold";

-- 3) Drop the now-migrated columns from the catalogue item.
ALTER TABLE "MenuItem" DROP COLUMN "lowStockThreshold",
DROP COLUMN "stockQty",
DROP COLUMN "trackStock";
