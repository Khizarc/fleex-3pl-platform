-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "boxHeightMm" INTEGER,
ADD COLUMN     "boxLengthMm" INTEGER,
ADD COLUMN     "boxWeightG" INTEGER,
ADD COLUMN     "boxWidthMm" INTEGER,
ADD COLUMN     "packNotes" TEXT,
ADD COLUMN     "packedAt" TIMESTAMP(3),
ADD COLUMN     "packedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Order_packedByUserId_idx" ON "Order"("packedByUserId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_packedByUserId_fkey" FOREIGN KEY ("packedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
