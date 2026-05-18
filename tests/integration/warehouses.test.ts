// Integration tests for the warehouses service layer + tenant isolation
// across the four-level nesting (Warehouse → Zone → Aisle → Bin).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db';
import {
  createAisle,
  createBin,
  createWarehouse,
  createZone,
  listWarehouses,
} from '@/features/warehouses';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Company A — Warehouses' } });
  companyB = await prisma.company.create({ data: { name: 'Company B — Warehouses' } });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('createWarehouse', () => {
  it('writes the row inside the caller tenant', async () => {
    const wh = await createWarehouse({ companyId: companyA.id }, { name: 'Main DC' });
    expect(wh.name).toBe('Main DC');
    expect(wh.companyId).toBe(companyA.id);
  });
});

describe('createZone (parent-derived companyId)', () => {
  it('derives companyId from the parent warehouse', async () => {
    const wh = await createWarehouse({ companyId: companyA.id }, { name: 'Zone-Test DC' });
    const zone = await createZone(
      { companyId: companyA.id },
      { warehouseId: wh.id, name: 'Receiving' },
    );
    expect(zone.warehouseId).toBe(wh.id);
    expect(zone.companyId).toBe(companyA.id);
  });
});

describe('end-to-end chain: Warehouse → Zone → Aisle → Bin', () => {
  it('creates the full chain with consistent companyId', async () => {
    const wh = await createWarehouse({ companyId: companyA.id }, { name: 'Chain DC' });
    const zone = await createZone(
      { companyId: companyA.id },
      { warehouseId: wh.id, name: 'Stock' },
    );
    const aisle = await createAisle({ companyId: companyA.id }, { zoneId: zone.id, name: 'A1' });
    const bin = await createBin({ companyId: companyA.id }, { aisleId: aisle.id, label: 'A1-01' });
    expect(bin.aisleId).toBe(aisle.id);
    expect(bin.companyId).toBe(companyA.id);
  });
});

describe('listWarehouses', () => {
  it('returns only the caller tenant’s warehouses (RLS through service layer)', async () => {
    await createWarehouse({ companyId: companyB.id }, { name: 'Beta DC' });

    const fromA = await listWarehouses({ companyId: companyA.id });
    const fromB = await listWarehouses({ companyId: companyB.id });

    expect(fromA.every((w) => w.companyId === companyA.id)).toBe(true);
    expect(fromB.every((w) => w.companyId === companyB.id)).toBe(true);
    expect(fromA.find((w) => w.name === 'Beta DC')).toBeUndefined();
    expect(fromB.find((w) => w.name === 'Main DC')).toBeUndefined();
  });
});

describe('Cross-tenant isolation (the Phase 1.1 acceptance test)', () => {
  it('Company A cannot read Company B’s bins via findUnique', async () => {
    const whB = await createWarehouse({ companyId: companyB.id }, { name: 'BCo DC' });
    const zoneB = await createZone({ companyId: companyB.id }, { warehouseId: whB.id, name: 'Z' });
    const aisleB = await createAisle({ companyId: companyB.id }, { zoneId: zoneB.id, name: 'A' });
    const binB = await createBin({ companyId: companyB.id }, { aisleId: aisleB.id, label: 'A-01' });

    const leak = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      return tx.bin.findUnique({ where: { id: binB.id } });
    });
    expect(leak).toBeNull();
  });

  it('createZone rejects a parent warehouse from a different tenant', async () => {
    // Company A creates its warehouse.
    const whA = await createWarehouse({ companyId: companyA.id }, { name: 'A-only DC' });

    // Inside Company B's context, try to create a zone under A's warehouse.
    // RLS hides whA from B's lookup, so findUniqueOrThrow throws.
    await expect(
      createZone({ companyId: companyB.id }, { warehouseId: whA.id, name: 'Intruder' }),
    ).rejects.toThrow();

    // No leak: A's warehouse has no rogue zones.
    const zonesUnderA = await prisma.zone.findMany({ where: { warehouseId: whA.id } });
    expect(zonesUnderA.length).toBe(0);
  });
});
