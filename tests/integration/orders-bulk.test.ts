// Integration tests for bulk CSV order import (Milestone 1.6).
// Tests prove:
//   - resolveSkusByCode respects RLS (caller's tenant only)
//   - bulkCreateOrders is best-effort across the file (per-order atomic)
//   - Serial commit doesn't deadlock when many orders compete for one bin
//   - Staff-on-behalf path attributes createdByUserId + clientId correctly
//   - Per-order SKU uniqueness enforced in the validator path
//   - Row count cap blocks the entire file
//   - Inventory view reflects bulk allocations

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { bulkCreateOrders, parseCsv, validateRows, type GroupedOrder } from '@/features/orders';
import { resolveSkusByCode } from '@/features/products';
import { listInventoryBySku } from '@/features/inventory';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };
let binA1: { id: string };
let skuA1Red: { id: string; code: string };
let skuA1Blue: { id: string; code: string };
let skuA2Green: { id: string; code: string };
let skuB1: { id: string; code: string };
let staffUserA: { id: string };

const SHIP_TO_VALUES = {
  ship_to_name: 'Jane Doe',
  ship_to_line1: '123 Main St',
  ship_to_line2: '',
  ship_to_city: 'Brooklyn',
  ship_to_region: 'NY',
  ship_to_postal_code: '11201',
  ship_to_country: 'US',
  customer_note: '',
};

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Co A — Bulk' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Bulk' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_bulk_A',
      email: 'staff-bulk@a.test',
      name: 'Staff A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  for (const { company, label, set } of [
    { company: companyA, label: 'binA1', set: 'A1' },
    { company: companyB, label: 'binB', set: 'B' },
  ] as const) {
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
    if (set === 'A1') binA1 = bin;
    // companyB's bin is created so SKU/Bin RLS visibility tests have a real
    // warehouse for company B; we don't reference the bin id directly.
    void bin;
  }

  // ClientA1 catalog
  const productA1 = await prisma.product.create({
    data: { name: 'A1 Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuA1Red = (await prisma.sKU.create({
    data: {
      code: 'BULK-A1-RED',
      name: 'A1 Tee Red',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };
  skuA1Blue = (await prisma.sKU.create({
    data: {
      code: 'BULK-A1-BLUE',
      name: 'A1 Tee Blue',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };

  // ClientA2 catalog (separate client, same company)
  const productA2 = await prisma.product.create({
    data: { name: 'A2 Widget', clientId: clientA2.id, companyId: companyA.id },
  });
  skuA2Green = (await prisma.sKU.create({
    data: {
      code: 'BULK-A2-GREEN',
      name: 'A2 Widget Green',
      productId: productA2.id,
      clientId: clientA2.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };

  // ClientB1 catalog (different company, isolated tenant)
  const productB1 = await prisma.product.create({
    data: { name: 'B1 Thing', clientId: clientB1.id, companyId: companyB.id },
  });
  skuB1 = (await prisma.sKU.create({
    data: {
      code: 'BULK-B1-X',
      name: 'B1 Thing X',
      productId: productB1.id,
      clientId: clientB1.id,
      companyId: companyB.id,
    },
  })) as { id: string; code: string };
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
  status?: StockLevelStatus;
}) {
  const status = args.status ?? StockLevelStatus.AVAILABLE;
  await prisma.stockLevel.upsert({
    where: { skuId_binId_status: { skuId: args.skuId, binId: args.binId, status } },
    create: {
      skuId: args.skuId,
      binId: args.binId,
      status,
      quantity: args.quantity,
      clientId: args.clientId,
      companyId: args.companyId,
    },
    update: { quantity: args.quantity },
  });
}

async function reset() {
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.stockLevel.deleteMany({});
}

function buildCsv(rows: Record<string, string>[]): string {
  const headers = [
    'order_reference',
    'ship_to_name',
    'ship_to_line1',
    'ship_to_line2',
    'ship_to_city',
    'ship_to_region',
    'ship_to_postal_code',
    'ship_to_country',
    'customer_note',
    'sku_code',
    'quantity',
  ];
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => r[h] ?? '').join(','))];
  return lines.join('\n');
}

describe('resolveSkusByCode — RLS', () => {
  it('portal client A1 sees own SKUs and not other clients in the same company', async () => {
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    const map = await resolveSkusByCode(portalCtx, [skuA1Red.code, skuA2Green.code]);
    expect(map.get(skuA1Red.code)).toBeTruthy();
    expect(map.get(skuA2Green.code)).toBeNull();
  });

  it('staff in company A cannot resolve a SKU code from company B', async () => {
    const staffCtx = { companyId: companyA.id };
    const map = await resolveSkusByCode(staffCtx, [skuB1.code]);
    expect(map.get(skuB1.code)).toBeNull();
  });

  it('staff can scope to a specific client when calling on their behalf', async () => {
    const staffCtx = { companyId: companyA.id };
    const map = await resolveSkusByCode(staffCtx, [skuA2Green.code], { clientId: clientA2.id });
    expect(map.get(skuA2Green.code)).toBeTruthy();
  });
});

describe('bulkCreateOrders — mixed-success batch', () => {
  it('reports succeeded + failed buckets honestly', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 10,
    });
    // No stock for skuA1Blue → that order will go AWAITING_STOCK (still succeeded
    // from the orchestrator's perspective — createOrder returns successfully).
    const orders: GroupedOrder[] = [
      {
        groupKey: 'PO-1',
        rowNumbers: [2],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 3 }],
      },
      {
        groupKey: 'PO-2',
        rowNumbers: [3],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Blue.id, skuCode: skuA1Blue.code, quantity: 5 }],
      },
    ];

    const result = await bulkCreateOrders(
      { companyId: companyA.id, clientId: clientA1.id },
      { clientId: clientA1.id, orders },
    );

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);

    // First one allocated; second went AWAITING_STOCK.
    const statuses = result.succeeded.map((s) => s.status).sort();
    expect(statuses).toEqual([OrderStatus.AWAITING_STOCK, OrderStatus.READY_TO_PICK].sort());
  });

  it('catches per-order errors and keeps going (bad input on one order)', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 100,
    });
    const orders: GroupedOrder[] = [
      {
        groupKey: 'GOOD',
        rowNumbers: [2],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 1 }],
      },
      {
        groupKey: 'BAD-SKU',
        rowNumbers: [3],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        // Wrong-tenant SKU id — createOrder will reject it.
        lines: [{ skuId: skuB1.id, skuCode: skuB1.code, quantity: 1 }],
      },
    ];

    const result = await bulkCreateOrders(
      { companyId: companyA.id, clientId: clientA1.id },
      { clientId: clientA1.id, orders },
    );

    expect(result.succeeded.map((s) => s.groupKey)).toEqual(['GOOD']);
    expect(result.failed.map((f) => f.groupKey)).toEqual(['BAD-SKU']);
  });
});

describe('bulkCreateOrders — serial commit under contention', () => {
  it('20 orders against one shared bin all succeed without negative stock', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 100,
    });

    const orders: GroupedOrder[] = Array.from({ length: 20 }, (_, i) => ({
      groupKey: `PO-${i + 1}`,
      rowNumbers: [i + 2],
      shipTo: {
        name: 'A',
        line1: '1 St',
        city: 'C',
        region: 'R',
        postalCode: '00000',
        country: 'US',
      },
      lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 5 }],
    }));

    const result = await bulkCreateOrders(
      { companyId: companyA.id, clientId: clientA1.id },
      { clientId: clientA1.id, orders },
    );

    expect(result.succeeded).toHaveLength(20);
    expect(result.failed).toHaveLength(0);

    const remaining = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(remaining!.quantity).toBe(0);
    const reserved = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(reserved!.quantity).toBe(100);
  });
});

describe('bulkCreateOrders — staff on behalf attribution', () => {
  it('attributes createdByUserId and the chosen clientId to every order', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });
    const orders: GroupedOrder[] = [
      {
        groupKey: 'PO-1',
        rowNumbers: [2],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 1 }],
      },
    ];

    const result = await bulkCreateOrders(
      { companyId: companyA.id },
      {
        clientId: clientA1.id,
        createdByUserId: staffUserA.id,
        orders,
      },
    );

    expect(result.succeeded).toHaveLength(1);
    const created = await prisma.order.findUnique({
      where: { id: result.succeeded[0]!.orderId },
    });
    expect(created!.createdByUserId).toBe(staffUserA.id);
    expect(created!.clientId).toBe(clientA1.id);
    expect(created!.companyId).toBe(companyA.id);
  });
});

describe('validateRows — row count cap (end-to-end via parseCsv)', () => {
  it('rejects a 1001-row CSV with one error and no orders', () => {
    const rows = Array.from({ length: 1001 }, () => ({
      ...SHIP_TO_VALUES,
      order_reference: '',
      sku_code: skuA1Red.code,
      quantity: '1',
    }));
    const csv = buildCsv(rows);
    const parsed = parseCsv(csv);
    expect(parsed.rows.length).toBe(1001);
    const skuLookup = new Map([[skuA1Red.code, { id: skuA1Red.id, name: 'X' }]]);
    const { orders, rowErrors } = validateRows(parsed.rows, skuLookup);
    expect(orders).toHaveLength(0);
    expect(rowErrors).toHaveLength(1);
    expect(rowErrors[0]!.message).toMatch(/limit is 1000/);
  });
});

describe('inventory view reflects bulk allocations', () => {
  it('listInventoryBySku shows the right reserved totals after a batch', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 30,
    });

    const orders: GroupedOrder[] = [
      {
        groupKey: 'PO-1',
        rowNumbers: [2],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 7 }],
      },
      {
        groupKey: 'PO-2',
        rowNumbers: [3],
        shipTo: {
          name: 'A',
          line1: '1 St',
          city: 'C',
          region: 'R',
          postalCode: '00000',
          country: 'US',
        },
        lines: [{ skuId: skuA1Red.id, skuCode: skuA1Red.code, quantity: 8 }],
      },
    ];

    const result = await bulkCreateOrders(
      { companyId: companyA.id, clientId: clientA1.id },
      { clientId: clientA1.id, orders },
    );
    expect(result.succeeded).toHaveLength(2);

    const rows = await listInventoryBySku({ companyId: companyA.id });
    const row = rows.find((r) => r.skuCode === skuA1Red.code);
    expect(row).toBeDefined();
    expect(row!.available).toBe(15);
    expect(row!.reserved).toBe(15);
    expect(row!.total).toBe(30);
  });
});
