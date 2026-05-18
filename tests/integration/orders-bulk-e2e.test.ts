// End-to-end test for the 1.6 bulk import path.
//
// Goes raw CSV string → parseCsv → resolveSkusByCode (real DB) → validateRows
// → bulkCreateOrders (real DB) → final state queries (listOrders + inventory).
// Exercises every layer EXCEPT the React component itself.
//
// This is what the production code path runs end to end: a real upload would
// only differ by where the CSV text comes from (file vs string in test).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  bulkCreateOrders,
  getOrder,
  listOrders,
  parseCsv,
  validateRows,
  type SkuLookup,
} from '@/features/orders';
import { resolveSkusByCode } from '@/features/products';
import {
  createPersonalizationField,
  listActivePersonalizationFields,
} from '@/features/personalization';
import { listInventoryBySku } from '@/features/inventory';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let clientA1: { id: string };
let binA1: { id: string };
let skuRed: { id: string; code: string };
let skuBlue: { id: string; code: string };
let staffUserA: { id: string };

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Co A — E2E' } });
  clientA1 = await prisma.client.create({ data: { name: 'Acme', companyId: companyA.id } });
  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_e2e_A',
      email: 'staff-e2e@a.test',
      name: 'Staff E2E',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  const wh = await prisma.warehouse.create({
    data: { name: 'E2E-DC', companyId: companyA.id },
  });
  const zone = await prisma.zone.create({
    data: { name: 'Z', warehouseId: wh.id, companyId: companyA.id },
  });
  const aisle = await prisma.aisle.create({
    data: { name: 'A', zoneId: zone.id, companyId: companyA.id },
  });
  binA1 = await prisma.bin.create({
    data: { label: 'binA1', aisleId: aisle.id, companyId: companyA.id },
  });

  const product = await prisma.product.create({
    data: { name: 'Acme Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuRed = (await prisma.sKU.create({
    data: {
      code: 'E2E-RED',
      name: 'Acme Tee Red',
      productId: product.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };
  skuBlue = (await prisma.sKU.create({
    data: {
      code: 'E2E-BLUE',
      name: 'Acme Tee Blue',
      productId: product.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };
  // SKU exists in catalog but no stock — drives the AWAITING_STOCK leg of
  // the e2e flow. Not referenced by id, only by code in the CSV string.
  await prisma.sKU.create({
    data: {
      code: 'E2E-GREEN',
      name: 'Acme Tee Green',
      productId: product.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  });

  // Seed stock: lots of RED, some BLUE, none GREEN
  for (const { sku, qty } of [
    { sku: skuRed, qty: 100 },
    { sku: skuBlue, qty: 3 },
  ]) {
    await prisma.stockLevel.create({
      data: {
        skuId: sku.id,
        binId: binA1.id,
        status: StockLevelStatus.AVAILABLE,
        quantity: qty,
        clientId: clientA1.id,
        companyId: companyA.id,
      },
    });
  }

  // Personalization: one optional engraving_text field, exercising the full
  // bulk-import pipeline including 1.7's CSV column recognition + DB writes.
  await createPersonalizationField(
    { companyId: companyA.id, clientId: clientA1.id },
    { clientId: clientA1.id, key: 'engraving_text', label: 'Engraving' },
  );
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('end-to-end CSV bulk upload', () => {
  it('runs the full pipeline from a Title Case header CSV to final DB state', async () => {
    // Simulate what a portal user uploads. Title Case headers, CRLF endings,
    // some valid orders, one with insufficient stock, one with an unknown SKU,
    // one valid multi-line order grouped by reference.
    const csv = [
      'Order Reference,Ship To Name,Ship To Line1,Ship To Line2,Ship To City,Ship To Region,Ship To Postal Code,Ship To Country,Customer Note,SKU Code,Quantity,Personalization Engraving Text',
      // Order 1: simple, plenty of stock — should land READY_TO_PICK
      'PO-A,Jane Doe,123 Main St,,Brooklyn,NY,11201,us,,E2E-RED,10,Happy Birthday',
      // Order 2: multi-line, grouped by PO-B — first line has engraving, second blank
      'PO-B,Bob Hill,9 Oak Rd,Suite 4,Austin,TX,73301,US,Leave at door,E2E-RED,5,To Bob',
      'PO-B,Bob Hill,9 Oak Rd,Suite 4,Austin,TX,73301,US,Leave at door,E2E-BLUE,2,',
      // Order 3: not enough BLUE stock — should land AWAITING_STOCK
      'PO-C,Carol Lin,1 Pine St,,Seattle,WA,98101,US,,E2E-BLUE,50,',
      // Order 4: typo'd SKU — should be skipped at validate stage
      'PO-D,Dan King,2 Birch Ln,,Portland,OR,97201,US,,E2E-PINK,1,',
      // Order 5: no GREEN stock at all — should land AWAITING_STOCK
      'PO-E,Eve Park,5 Elm Ave,,Boston,MA,02108,US,,E2E-GREEN,1,',
    ].join('\r\n');

    // 1) Parse (client-side step, deterministic)
    const parsed = parseCsv(csv);
    expect(parsed.parseErrors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(6);

    // 2) Resolve SKUs against the real DB via RLS
    const codes = Array.from(
      new Set(parsed.rows.map((r) => r.sku_code).filter((c): c is string => typeof c === 'string')),
    );
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    const skuMap = await resolveSkusByCode(portalCtx, codes);
    const lookup: SkuLookup = new Map(skuMap);
    expect(lookup.get('E2E-RED')).toBeTruthy();
    expect(lookup.get('E2E-PINK')).toBeNull();

    // 3) Resolve active personalization definitions (1.7)
    const definitions = (await listActivePersonalizationFields(portalCtx)).map((f) => ({
      id: f.id,
      key: f.key,
      required: f.required,
      status: f.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    }));

    // 4) Validate + group
    const { orders, rowErrors } = validateRows(parsed.rows, lookup, definitions);
    expect(orders.map((o) => o.groupKey).sort()).toEqual(['PO-A', 'PO-B', 'PO-C', 'PO-E']);
    expect(rowErrors).toHaveLength(1);
    expect(rowErrors[0]!.message).toMatch(/E2E-PINK/);

    // 5) Commit through bulkCreateOrders (real DB writes via createOrder)
    const result = await bulkCreateOrders(portalCtx, {
      clientId: clientA1.id,
      orders,
      createdByUserId: staffUserA.id,
    });

    expect(result.failed).toHaveLength(0);
    expect(result.succeeded).toHaveLength(4);

    const statusByGroup = new Map(result.succeeded.map((s) => [s.groupKey, s.status]));
    expect(statusByGroup.get('PO-A')).toBe(OrderStatus.READY_TO_PICK);
    expect(statusByGroup.get('PO-B')).toBe(OrderStatus.READY_TO_PICK);
    expect(statusByGroup.get('PO-C')).toBe(OrderStatus.AWAITING_STOCK);
    expect(statusByGroup.get('PO-E')).toBe(OrderStatus.AWAITING_STOCK);

    // 5) Final state: listOrders sees four orders, each with correct shape
    const all = await listOrders(portalCtx);
    expect(all).toHaveLength(4);
    const po_b = all.find((o) => o.shipToCity === 'Austin')!;
    expect(po_b.lineCount).toBe(2);
    expect(po_b.totalQuantity).toBe(7);

    // 6) Inventory view reflects the two READY_TO_PICK allocations.
    // RED: 100 - 10 (PO-A) - 5 (PO-B) = 85 available, 15 reserved
    // BLUE: 3 - 2 (PO-B) = 1 available, 2 reserved
    // GREEN: still no stock (only failed/awaiting orders)
    const inv = await listInventoryBySku(portalCtx);
    const red = inv.find((r) => r.skuCode === 'E2E-RED');
    expect(red).toBeDefined();
    expect(red!.available).toBe(85);
    expect(red!.reserved).toBe(15);
    const blue = inv.find((r) => r.skuCode === 'E2E-BLUE');
    expect(blue).toBeDefined();
    expect(blue!.available).toBe(1);
    expect(blue!.reserved).toBe(2);

    // 7) PO-C and PO-E should have zero allocations (AWAITING_STOCK).
    const poC = await prisma.order.findFirst({
      where: { id: result.succeeded.find((s) => s.groupKey === 'PO-C')!.orderId },
      include: { lines: { include: { allocations: true } } },
    });
    expect(poC!.allocatedAt).toBeNull();
    expect(poC!.lines.flatMap((l) => l.allocations)).toHaveLength(0);

    // 8) Personalization landed: PO-A line should have "Happy Birthday";
    // PO-B's RED line should have "To Bob"; PO-B's BLUE line empty.
    const poAId = result.succeeded.find((s) => s.groupKey === 'PO-A')!.orderId;
    const poBId = result.succeeded.find((s) => s.groupKey === 'PO-B')!.orderId;
    const poA = await getOrder(portalCtx, poAId);
    expect(poA.lines[0]!.personalizations[0]!.value).toBe('Happy Birthday');
    const poB = await getOrder(portalCtx, poBId);
    const bLineByCode = Object.fromEntries(poB.lines.map((l) => [l.sku.code, l]));
    expect(bLineByCode['E2E-RED']!.personalizations[0]!.value).toBe('To Bob');
    expect(bLineByCode['E2E-BLUE']!.personalizations).toHaveLength(0);
  });
});
