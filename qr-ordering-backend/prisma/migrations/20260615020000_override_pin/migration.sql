-- Hashed manager PIN used to authorise price overrides (set up in Settings).
ALTER TABLE "Store" ADD COLUMN "overridePinHash" TEXT;
