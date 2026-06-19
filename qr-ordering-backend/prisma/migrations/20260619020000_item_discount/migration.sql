-- Standing promotional discount on a menu item (shown on the customer menu and
-- charged on order). discountType PERCENT/FIXED (null = none); value is % or RM.
ALTER TABLE "MenuItem" ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;
