// Integration tests for the inventory aggregation service.
// Verifies the groupBy + pivot logic, two-level RLS, and cross-tenant
// isolation on the read side.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { listInventoryBySku } from '@/features/inventory';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

// Build a small two-company / two-client world with bins ready for stock.
let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };
let bin1: { id: string };
let bin2: { id: string };
let binB: { id: string };
let skuA1Red: { id: string };
let skuA1Blue: { id: string };
let skuA2Green: { id: string };
let skuB1: { id: string };

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Co A — Inventory' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Inventory' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  // Build two bins for Company A and one for Company B
  for (const { company, label } of [
    { company: companyA, label: 'bin1' },
    { company: companyA, label: 'bin2' },
    { company: companyB, label: 'binB' },
  ]) {
    const wh = await prisma.warehouse.create({
      data: { name: `${label}-DC`, companyId: company.id },
    });
    const zone = await prisma.zone.create({
      data: { name: 'Z', warehouseId: wh.id, companyId: company.id },
    });
    const aisle = await prisma.aisle.create({
      data: { name: 'A', zoneId: zone.id, companyId: company.id },
    });
    const bin = await prisma.bin.create({
      data: { label, aisleId: aisle.id, companyId: company.id },
    });
    if (label === 'bin1') bin1 = bin;
    if (label === 'bin2') bin2 = bin;
    if (label === 'binB') binB = bin;
  }

  // Build products + SKUs per client
  const productA1 = await prisma.product.create({
    data: { name: 'A1 Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuA1Red = await prisma.sKU.create({
    data: {
      code: 'A1-RED',
      name: 'A1 Tee Red',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  });
  skuA1Blue = await prisma.sKU.create({
    data: {
      code: 'A1-BLUE',
      name: 'A1 Tee Blue',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  });

  const productA2 = await prisma.product.create({
    data: { name: 'A2 Widget', clientId: clientA2.id, companyId: companyA.id },
  });
  skuA2Green = await prisma.sKU.create({
    data: {
      code: 'A2-GREEN',
      name: 'A2 Widget Green',
      productId: productA2.id,
      clientId: clientA2.id,
      companyId: companyA.id,
    },
  });

  const productB1 = await prisma.product.create({
    data: { name: 'B1 Thing', clientId: clientB1.id, companyId: companyB.id },
  });
  skuB1 = await prisma.sKU.create({
    data: {
      code: 'B1-X',
      name: 'B1 Thing X',
      productId: productB1.id,
      clientId: clientB1.id,
      companyId: companyB.id,
    },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

async function setStock(args: {
  skuId: string;
  binId: string;
  clientId: string;
  companyId: string;
  quantity: number;
  status: StockLevelStatus;
}) {
  // Direct StockLevel write via the owner client (tests bypass RLS for setup).
  await prisma.stockLevel.upsert({
    where: {
      skuId_binId_status: { skuId: args.skuId, binId: args.binId, status: args.status },
    },
    create: {
      skuId: args.skuId,
      binId: args.binId,
      status: args.status,
      quantity: args.quantity,
      clientId: args.clientId,
      companyId: args.companyId,
    },
    update: { quantity: args.quantity },
  });
}

describe('listInventoryBySku — aggregation', () => {
  it('sums quantities across multiple bins for the same SKU + status', async () => {
    await setStock({
      skuId: skuA1Red.id,
      binId: bin1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 30,
      status: StockLevelStatus.AVAILABLE,
    });
    await setStock({
      skuId: skuA1Red.id,
      binId: bin2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 40,
      status: StockLevelStatus.AVAILABLE,
    });

    const rows = await listInventoryBySku({ companyId: companyA.id });
    const row = rows.find((r) => r.skuCode === 'A1-RED');
    expect(row).toBeDefined();
    expect(row!.available).toBe(70);
    expect(row!.reserved).toBe(0);
    expect(row!.onHold).toBe(0);
    expect(row!.damaged).toBe(0);
    expect(row!.total).toBe(70);
  });

  it('splits AVAILABLE and DAMAGED into different columns', async () => {
    await setStock({
      skuId: skuA1Blue.id,
      binId: bin1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 30,
      status: StockLevelStatus.AVAILABLE,
    });
    await setStock({
      skuId: skuA1Blue.id,
      binId: bin1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
      status: StockLevelStatus.DAMAGED,
    });

    const rows = await listInventoryBySku({ companyId: companyA.id });
    const row = rows.find((r) => r.skuCode === 'A1-BLUE');
    expect(row!.available).toBe(30);
    expect(row!.damaged).toBe(5);
    expect(row!.total).toBe(35);
  });

  it('returns one row per SKU when multiple SKUs have stock', async () => {
    // A1-RED + A1-BLUE were set above. Add A2-GREEN now.
    await setStock({
      skuId: skuA2Green.id,
      binId: bin1.id,
      clientId: clientA2.id,
      companyId: companyA.id,
      quantity: 12,
      status: StockLevelStatus.AVAILABLE,
    });

    const rows = await listInventoryBySku({ companyId: companyA.id });
    const codes = rows.map((r) => r.skuCode);
    expect(codes).toContain('A1-RED');
    expect(codes).toContain('A1-BLUE');
    expect(codes).toContain('A2-GREEN');
  });
});

describe('two-level RLS', () => {
  it('staff context sees all clients in the company', async () => {
    const rows = await listInventoryBySku({ companyId: companyA.id });
    const clientNames = new Set(rows.map((r) => r.clientName));
    expect(clientNames.has('A1')).toBe(true);
    expect(clientNames.has('A2')).toBe(true);
  });

  it('portal context sees only own-client rows', async () => {
    const rows = await listInventoryBySku({ companyId: companyA.id, clientId: clientA1.id });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.clientId === clientA1.id)).toBe(true);
    expect(rows.find((r) => r.clientName === 'A2')).toBeUndefined();
  });
});

describe('cross-tenant isolation', () => {
  it('Company A staff cannot see Company B stock even if A has no stock yet', async () => {
    await setStock({
      skuId: skuB1.id,
      binId: binB.id,
      clientId: clientB1.id,
      companyId: companyB.id,
      quantity: 99,
      status: StockLevelStatus.AVAILABLE,
    });

    const fromA = await listInventoryBySku({ companyId: companyA.id });
    expect(fromA.find((r) => r.skuCode === 'B1-X')).toBeUndefined();

    const fromB = await listInventoryBySku({ companyId: companyB.id });
    expect(fromB.find((r) => r.skuCode === 'B1-X')).toBeDefined();
  });
});

describe('empty state', () => {
  it('returns empty array (not error) when there is no stock at all', async () => {
    // Wipe stock for an isolated test
    await prisma.stockLevel.deleteMany({});
    const rows = await listInventoryBySku({ companyId: companyA.id });
    expect(rows).toEqual([]);
  });
});
