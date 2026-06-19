-- Store-level takeaway packaging charge (per takeaway item, waivable per line).
ALTER TABLE "Store" ADD COLUMN "takeawayCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Per-line takeaway flag + applied charge, and a manual price-override marker.
ALTER TABLE "OrderItem" ADD COLUMN "isTakeaway" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "takeawayCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "priceOverridden" BOOLEAN NOT NULL DEFAULT false;
