-- Allow custom (open) order lines added by staff: a null menuItemId means the
-- line has no backing menu item (its name + price are stored on the row).
ALTER TABLE "OrderItem" ALTER COLUMN "menuItemId" DROP NOT NULL;
