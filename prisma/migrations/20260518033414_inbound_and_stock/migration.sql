-- CreateEnum
CREATE TYPE "InboundShipmentStatus" AS ENUM ('NOTIFIED', 'RECEIVING', 'COMPLETED', 'COMPLETED_WITH_DISCREPANCIES');

-- CreateEnum
CREATE TYPE "StockLevelStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ON_HOLD', 'DAMAGED');

-- CreateTable
CREATE TABLE "InboundShipment" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "expectedArrivalAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "InboundShipmentStatus" NOT NULL DEFAULT 'NOTIFIED',
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundShipmentLine" (
    "id" TEXT NOT NULL,
    "inboundShipmentId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER,
    "binId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "notes" TEXT,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockLevelStatus" NOT NULL DEFAULT 'AVAILABLE',
    "skuId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundShipment_clientId_idx" ON "InboundShipment"("clientId");

-- CreateIndex
CREATE INDEX "InboundShipment_companyId_idx" ON "InboundShipment"("companyId");

-- CreateIndex
CREATE INDEX "InboundShipment_warehouseId_idx" ON "InboundShipment"("warehouseId");

-- CreateIndex
CREATE INDEX "InboundShipment_status_idx" ON "InboundShipment"("status");

-- CreateIndex
CREATE INDEX "InboundShipmentLine_inboundShipmentId_idx" ON "InboundShipmentLine"("inboundShipmentId");

-- CreateIndex
CREATE INDEX "InboundShipmentLine_skuId_idx" ON "InboundShipmentLine"("skuId");

-- CreateIndex
CREATE INDEX "InboundShipmentLine_clientId_idx" ON "InboundShipmentLine"("clientId");

-- CreateIndex
CREATE INDEX "InboundShipmentLine_companyId_idx" ON "InboundShipmentLine"("companyId");

-- CreateIndex
CREATE INDEX "StockLevel_skuId_idx" ON "StockLevel"("skuId");

-- CreateIndex
CREATE INDEX "StockLevel_binId_idx" ON "StockLevel"("binId");

-- CreateIndex
CREATE INDEX "StockLevel_clientId_idx" ON "StockLevel"("clientId");

-- CreateIndex
CREATE INDEX "StockLevel_companyId_idx" ON "StockLevel"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_skuId_binId_status_key" ON "StockLevel"("skuId", "binId", "status");

-- AddForeignKey
ALTER TABLE "InboundShipment" ADD CONSTRAINT "InboundShipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipment" ADD CONSTRAINT "InboundShipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipmentLine" ADD CONSTRAINT "InboundShipmentLine_inboundShipmentId_fkey" FOREIGN KEY ("inboundShipmentId") REFERENCES "InboundShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipmentLine" ADD CONSTRAINT "InboundShipmentLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipmentLine" ADD CONSTRAINT "InboundShipmentLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipmentLine" ADD CONSTRAINT "InboundShipmentLine_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security (Milestone 1.3)
-- ============================================================================
-- Two-level tenant filter (Company + optional Client) — same pattern as
-- Product/SKU. Staff context (no client_id set) sees all clients' rows;
-- portal context (client_id set) sees only own-client rows.

ALTER TABLE "InboundShipment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InboundShipment"
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

ALTER TABLE "InboundShipmentLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InboundShipmentLine"
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

ALTER TABLE "StockLevel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockLevel"
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
