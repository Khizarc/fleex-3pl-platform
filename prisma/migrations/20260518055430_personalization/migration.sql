-- CreateTable
CREATE TABLE "PersonalizationField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalizationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLinePersonalization" (
    "id" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLinePersonalization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalizationField_clientId_status_idx" ON "PersonalizationField"("clientId", "status");

-- CreateIndex
CREATE INDEX "PersonalizationField_companyId_idx" ON "PersonalizationField"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationField_clientId_key_key" ON "PersonalizationField"("clientId", "key");

-- CreateIndex
CREATE INDEX "OrderLinePersonalization_orderLineItemId_idx" ON "OrderLinePersonalization"("orderLineItemId");

-- CreateIndex
CREATE INDEX "OrderLinePersonalization_fieldId_idx" ON "OrderLinePersonalization"("fieldId");

-- CreateIndex
CREATE INDEX "OrderLinePersonalization_clientId_idx" ON "OrderLinePersonalization"("clientId");

-- CreateIndex
CREATE INDEX "OrderLinePersonalization_companyId_idx" ON "OrderLinePersonalization"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLinePersonalization_orderLineItemId_fieldId_key" ON "OrderLinePersonalization"("orderLineItemId", "fieldId");

-- AddForeignKey
ALTER TABLE "PersonalizationField" ADD CONSTRAINT "PersonalizationField_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLinePersonalization" ADD CONSTRAINT "OrderLinePersonalization_orderLineItemId_fkey" FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLinePersonalization" ADD CONSTRAINT "OrderLinePersonalization_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "PersonalizationField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security (Milestone 1.7)
-- ============================================================================
-- Same two-level pattern as InboundShipment / Order. Staff context sees all
-- clients' rows; portal context sees only own-client rows.

ALTER TABLE "PersonalizationField" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PersonalizationField"
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

ALTER TABLE "OrderLinePersonalization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderLinePersonalization"
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
