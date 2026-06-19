-- Multi-tenancy: each admin belongs to a Store (the tenant), and stores can be
-- suspended. Existing admins are backfilled to the first (seeded) store.

ALTER TABLE "Store" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AdminUser" ADD COLUMN "storeId" TEXT;
UPDATE "AdminUser"
  SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "createdAt" ASC LIMIT 1)
  WHERE "storeId" IS NULL;
ALTER TABLE "AdminUser" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "AdminUser"
  ADD CONSTRAINT "AdminUser_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AdminUser_storeId_idx" ON "AdminUser"("storeId");
