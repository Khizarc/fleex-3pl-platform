-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AWAITING_STOCK', 'READY_TO_PICK', 'PICKING', 'PICKED', 'PACKING', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'ON_HOLD', 'EXCEPTION', 'PARTIALLY_SHIPPED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "customerNote" TEXT,
    "shipToName" TEXT NOT NULL,
    "shipToLine1" TEXT NOT NULL,
    "shipToLine2" TEXT,
    "shipToCity" TEXT NOT NULL,
    "shipToRegion" TEXT NOT NULL,
    "shipToPostalCode" TEXT NOT NULL,
    "shipToCountry" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdByClientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineAllocation" (
    "id" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "quantityReserved" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_reference_key" ON "Order"("companyId", "reference");

-- CreateIndex
CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderLineItem_skuId_idx" ON "OrderLineItem"("skuId");

-- CreateIndex
CREATE INDEX "OrderLineItem_clientId_idx" ON "OrderLineItem"("clientId");

-- CreateIndex
CREATE INDEX "OrderLineItem_companyId_idx" ON "OrderLineItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineItem_orderId_skuId_key" ON "OrderLineItem"("orderId", "skuId");

-- CreateIndex
CREATE INDEX "OrderLineAllocation_orderLineItemId_idx" ON "OrderLineAllocation"("orderLineItemId");

-- CreateIndex
CREATE INDEX "OrderLineAllocation_binId_idx" ON "OrderLineAllocation"("binId");

-- CreateIndex
CREATE INDEX "OrderLineAllocation_clientId_idx" ON "OrderLineAllocation"("clientId");

-- CreateIndex
CREATE INDEX "OrderLineAllocation_companyId_idx" ON "OrderLineAllocation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineAllocation_orderLineItemId_binId_key" ON "OrderLineAllocation"("orderLineItemId", "binId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByClientUserId_fkey" FOREIGN KEY ("createdByClientUserId") REFERENCES "ClientUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineAllocation" ADD CONSTRAINT "OrderLineAllocation_orderLineItemId_fkey" FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineAllocation" ADD CONSTRAINT "OrderLineAllocation_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security (Milestone 1.5)
-- ============================================================================
-- Two-level tenant filter (Company + optional Client) — same pattern as
-- InboundShipment / StockLevel. Staff context (no client_id set) sees all
-- clients' rows; portal context (client_id set) sees only own-client rows.

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  USING (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  );

ALTER TABLE "OrderLineItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderLineItem"
  USING (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  );

ALTER TABLE "OrderLineAllocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderLineAllocation"
  USING (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  );
