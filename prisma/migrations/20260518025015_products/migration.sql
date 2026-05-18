-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKU" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "productId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SKU_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_clientId_name_key" ON "Product"("clientId", "name");

-- CreateIndex
CREATE INDEX "SKU_productId_idx" ON "SKU"("productId");

-- CreateIndex
CREATE INDEX "SKU_clientId_idx" ON "SKU"("clientId");

-- CreateIndex
CREATE INDEX "SKU_companyId_idx" ON "SKU"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_clientId_code_key" ON "SKU"("clientId", "code");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKU" ADD CONSTRAINT "SKU_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security (Milestone 1.2)
-- ============================================================================
-- Two-level tenant filter (Company + optional Client) — same pattern as
-- `Client` and `ClientUser` in the init migration. Staff context (no
-- app.current_client_id set) sees every product/sku of their company;
-- client-portal context (app.current_client_id = <client.id>) sees only
-- the own-client rows. WITH CHECK applies the same predicate to INSERTs
-- and UPDATEs.

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
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

ALTER TABLE "SKU" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SKU"
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
