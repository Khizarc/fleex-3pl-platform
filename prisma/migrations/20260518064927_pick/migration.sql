-- AlterTable
ALTER TABLE "OrderLineAllocation" ADD COLUMN     "pickedAt" TIMESTAMP(3),
ADD COLUMN     "pickedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "OrderLineAllocation_pickedByUserId_idx" ON "OrderLineAllocation"("pickedByUserId");

-- AddForeignKey
ALTER TABLE "OrderLineAllocation" ADD CONSTRAINT "OrderLineAllocation_pickedByUserId_fkey" FOREIGN KEY ("pickedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
