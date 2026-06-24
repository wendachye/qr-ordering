-- CreateTable
CREATE TABLE "MenuItemOutletState" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "priceOverride" DECIMAL(10,2),
    "isAvailableOverride" BOOLEAN,
    "isActiveOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemOutletState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemOutletState_storeId_idx" ON "MenuItemOutletState"("storeId");

-- CreateIndex
CREATE INDEX "MenuItemOutletState_menuItemId_idx" ON "MenuItemOutletState"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemOutletState_storeId_menuItemId_key" ON "MenuItemOutletState"("storeId", "menuItemId");

-- AddForeignKey
ALTER TABLE "MenuItemOutletState" ADD CONSTRAINT "MenuItemOutletState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemOutletState" ADD CONSTRAINT "MenuItemOutletState_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

