-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedToUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "authProviderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Order_assignedToUserId_idx" ON "Order"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
