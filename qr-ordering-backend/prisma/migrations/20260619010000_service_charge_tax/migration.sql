-- Service charge + tax (SST) config on the store. Percentages (e.g. 10.00 /
-- 6.00); 0 = not applied. Menu prices are tax-inclusive — reports back out
-- these portions from the collected total.
ALTER TABLE "Store" ADD COLUMN     "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxLabel" TEXT NOT NULL DEFAULT 'SST';
