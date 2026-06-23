-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "einvoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "einvoiceMode" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "sellerAddress" TEXT,
ADD COLUMN     "sellerEmail" TEXT,
ADD COLUMN     "sellerMsic" TEXT,
ADD COLUMN     "sellerPhone" TEXT,
ADD COLUMN     "sellerRegistrationNo" TEXT,
ADD COLUMN     "sellerSstNo" TEXT,
ADD COLUMN     "sellerTin" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "number" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerTin" TEXT,
    "buyerRegistrationNo" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "buyerAddress" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "serviceCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "document" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submissionUid" TEXT,
    "longId" TEXT,
    "validationUrl" TEXT,
    "qrCode" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "storeId" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sessionId_key" ON "Invoice"("sessionId");

-- CreateIndex
CREATE INDEX "Invoice_storeId_createdAt_idx" ON "Invoice"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_storeId_number_key" ON "Invoice"("storeId", "number");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

