-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "posOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboGroup" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Combo_storeId_idx" ON "Combo"("storeId");

-- CreateIndex
CREATE INDEX "ComboGroup_comboId_idx" ON "ComboGroup"("comboId");

-- CreateIndex
CREATE INDEX "ComboOption_groupId_idx" ON "ComboOption"("groupId");

-- CreateIndex
CREATE INDEX "ComboOption_menuItemId_idx" ON "ComboOption"("menuItemId");

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboGroup" ADD CONSTRAINT "ComboGroup_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOption" ADD CONSTRAINT "ComboOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ComboGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOption" ADD CONSTRAINT "ComboOption_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

