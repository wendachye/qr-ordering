-- Store: configurable payment methods + whether voiding requires the PIN.
ALTER TABLE "Store" ADD COLUMN "voidPinRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "paymentMethods" TEXT[] NOT NULL
  DEFAULT ARRAY['Cash','Visa','Mastercard','GrabPay','Touch ''n Go']::TEXT[];

-- OrderItem: per-item void (with optional reason).
ALTER TABLE "OrderItem" ADD COLUMN "voided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "voidedAt" TIMESTAMP(3);

-- TableSession: payment method recorded at settlement.
ALTER TABLE "TableSession" ADD COLUMN "paymentMethod" TEXT;
