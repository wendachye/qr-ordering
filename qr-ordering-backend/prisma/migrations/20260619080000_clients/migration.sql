-- Platform clients (account/brand) that own outlets (Stores). Additive + backfill.

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Store" ADD COLUMN "clientId" TEXT;

-- Backfill: create one client per existing store (deterministic id), then link.
INSERT INTO "Client" ("id", "name", "isActive", "createdAt", "updatedAt")
  SELECT 'cl_' || s."id", s."name", true, now(), now() FROM "Store" s;
UPDATE "Store" s SET "clientId" = 'cl_' || s."id";

CREATE INDEX "Store_clientId_idx" ON "Store"("clientId");
ALTER TABLE "Store" ADD CONSTRAINT "Store_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
