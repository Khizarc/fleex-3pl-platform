-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECEIVER', 'PICKER', 'PACKER', 'SHIPPER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "logoUrl" TEXT,
    "brandName" TEXT,
    "primaryColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authProviderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUser" (
    "id" TEXT NOT NULL,
    "authProviderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_authProviderId_idx" ON "User"("authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_name_key" ON "Client"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_authProviderId_key" ON "ClientUser"("authProviderId");

-- CreateIndex
CREATE INDEX "ClientUser_clientId_idx" ON "ClientUser"("clientId");

-- CreateIndex
CREATE INDEX "ClientUser_companyId_idx" ON "ClientUser"("companyId");

-- CreateIndex
CREATE INDEX "ClientUser_authProviderId_idx" ON "ClientUser"("authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_clientId_email_key" ON "ClientUser"("clientId", "email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security (Milestone 0.2)
-- ============================================================================
-- Two-role pattern:
--   - Owner role (whoever owns the schema — `neondb_owner` on Neon, `postgres`
--     in CI). Bypasses RLS naturally. Used for migrations and test setup.
--   - app_user: a NOLOGIN role. App code switches to it via
--     `SET LOCAL ROLE app_user` inside a transaction, so policies apply.
--
-- Tenant context variables (transaction-scoped via `set_config(..., true)`):
--   app.current_company_id  — always set when there's any tenant context
--   app.current_client_id   — set only for Client Portal requests
--
-- `current_setting('...', true)` returns '' when unset → policy fails closed
-- (no rows visible). This is the safe default.
-- ============================================================================

-- Create the runtime role (idempotent so `prisma migrate reset` re-runs cleanly).
DO $$ BEGIN
  CREATE ROLE app_user;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Migration-runner must be a member of app_user in order to `SET ROLE` to it
-- at runtime. `current_user` differs by environment (neondb_owner on Neon,
-- postgres in CI) — the format() call handles both.
DO $$ BEGIN
  EXECUTE format('GRANT app_user TO %I', current_user);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Schema + table privileges for app_user.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Future tables created in this schema inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ----------------------------------------------------------------------------
-- Company: a user can only see their own company. WITH CHECK (true) keeps
-- INSERT unrestricted because signup happens outside any tenant context.
-- ----------------------------------------------------------------------------
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Company"
  USING (id = current_setting('app.current_company_id', true))
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- User: staff records, scoped to their company.
-- ----------------------------------------------------------------------------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "User"
  USING ("companyId" = current_setting('app.current_company_id', true))
  WITH CHECK ("companyId" = current_setting('app.current_company_id', true));

-- ----------------------------------------------------------------------------
-- Client: scoped to company. If a client context is set (Client Portal user),
-- additionally restricted to that single client row. WITH CHECK only enforces
-- company match because creating a client is a staff action — the client
-- context will not be set during INSERT.
-- ----------------------------------------------------------------------------
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Client"
  USING (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR id = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK ("companyId" = current_setting('app.current_company_id', true));

-- ----------------------------------------------------------------------------
-- ClientUser: same two-level pattern as Client.
-- ----------------------------------------------------------------------------
ALTER TABLE "ClientUser" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ClientUser"
  USING (
    "companyId" = current_setting('app.current_company_id', true)
    AND (
      current_setting('app.current_client_id', true) = ''
      OR "clientId" = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK ("companyId" = current_setting('app.current_company_id', true));
