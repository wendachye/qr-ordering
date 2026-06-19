-- Multiple named taxes on the store (JSON list), backfilled from the single
-- legacy tax. Plus voucher tables and per-tab voucher fields.

ALTER TABLE "Store" ADD COLUMN "taxes" JSONB NOT NULL DEFAULT '[]';

UPDATE "Store"
SET "taxes" = jsonb_build_array(jsonb_build_object('name', "taxLabel", 'rate', "taxRate"))
WHERE "taxRate" > 0;

ALTER TABLE "TableSession" ADD COLUMN "voucherCode" TEXT,
ADD COLUMN "voucherDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "Voucher" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "minSpend" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "maxRedemptions" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Voucher_storeId_code_key" ON "Voucher"("storeId", "code");
CREATE INDEX "Voucher_storeId_idx" ON "Voucher"("storeId");

CREATE TABLE "VoucherRedemption" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "sessionId" TEXT,
  "code" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VoucherRedemption_voucherId_idx" ON "VoucherRedemption"("voucherId");
CREATE INDEX "VoucherRedemption_storeId_idx" ON "VoucherRedemption"("storeId");
CREATE INDEX "VoucherRedemption_sessionId_idx" ON "VoucherRedemption"("sessionId");

ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
