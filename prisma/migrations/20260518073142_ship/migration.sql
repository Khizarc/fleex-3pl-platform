-- CreateEnum
CREATE TYPE "Carrier" AS ENUM ('USPS', 'UPS', 'FEDEX', 'DHL', 'OTHER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "carrier" "Carrier",
ADD COLUMN     "carrierOther" TEXT,
ADD COLUMN     "shipNotes" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippedByUserId" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateIndex
CREATE INDEX "Order_shippedByUserId_idx" ON "Order"("shippedByUserId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippedByUserId_fkey" FOREIGN KEY ("shippedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
