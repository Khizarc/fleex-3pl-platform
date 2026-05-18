// The standing tenant-isolation suite. Per docs/BUILD-PLAN.md §8, this must
// stay green from Phase 0 onward; a failure here blocks every other change.
//
// Architecture: see docs/ARCHITECTURE.md §3 (two-level tenancy + RLS) and
// the migration at prisma/migrations/.../migration.sql (policies).

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

// Fixture data — created once as the schema owner (bypasses RLS),
// then verified by queries running under `app_user` (RLS-enforced).
let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientB1: { id: string };

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Company A' } });
  companyB = await prisma.company.create({ data: { name: 'Company B' } });
  clientA1 = await prisma.client.create({
    data: { name: 'Client A1', companyId: companyA.id },
  });
  // Client A2 exists for the "Company A sees both clients" assertion but its
  // ID isn't referenced individually.
  await prisma.client.create({
    data: { name: 'Client A2', companyId: companyA.id },
  });
  clientB1 = await prisma.client.create({
    data: { name: 'Client B1', companyId: companyB.id },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('Tenant isolation (RLS)', () => {
  it('within Company A context: sees only Company A clients', async () => {
    const names = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      const rows = await tx.client.findMany({ select: { name: true } });
      return rows.map((r) => r.name).sort();
    });
    expect(names).toEqual(['Client A1', 'Client A2']);
  });

  it('within Company B context: sees only Company B clients', async () => {
    const names = await withTenantContext({ companyId: companyB.id }, async (tx) => {
      const rows = await tx.client.findMany({ select: { name: true } });
      return rows.map((r) => r.name);
    });
    expect(names).toEqual(['Client B1']);
  });

  it('within Client A1 context (companyId + clientId): sees only its own row', async () => {
    const names = await withTenantContext(
      { companyId: companyA.id, clientId: clientA1.id },
      async (tx) => {
        const rows = await tx.client.findMany({ select: { name: true } });
        return rows.map((r) => r.name);
      },
    );
    expect(names).toEqual(['Client A1']);
  });

  it('cross-tenant findUnique returns null (not a leak that "exists elsewhere")', async () => {
    const found = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      return tx.client.findUnique({ where: { id: clientB1.id } });
    });
    expect(found).toBeNull();
  });

  it('no tenant context under app_user: returns zero rows (fail-closed)', async () => {
    // Switch role to app_user inside a transaction, but DO NOT set tenant context.
    // current_setting(..., true) returns '' which matches no real ID.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE app_user');
      return tx.client.findMany();
    });
    expect(rows).toEqual([]);
  });

  it('Company A context cannot read Company B (top-level RLS on Company)', async () => {
    const companies = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      return tx.company.findMany({ select: { name: true } });
    });
    expect(companies.map((c) => c.name)).toEqual(['Company A']);
  });
});
