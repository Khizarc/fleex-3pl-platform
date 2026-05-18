// Integration tests for orders + allocation + cancellation.
// Second state-machine in the codebase. Tests prove:
//   - FIFO allocation across bins
//   - Atomicity (failed allocation leaves no side effects)
//   - Cancel reverses allocation precisely
//   - Two-level RLS + cross-tenant isolation
//   - The 1.4 inventory view picks up RESERVED writes

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  IllegalStateTransitionError,
  allocateOrder,
  cancelOrder,
  createOrder,
  getOrder,
  listOrders,
} from '@/features/orders';
import { listInventoryBySku } from '@/features/inventory';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

// Fixtures
let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };
let binA1: { id: string };
let binA2: { id: string };
let binB: { id: string };
let skuA1Red: { id: string };
let skuA1Blue: { id: string };
let skuA2Green: { id: string };
let skuB1: { id: string };
let staffUserA: { id: string };

const SHIP_TO = {
  shipToName: 'Jane Doe',
  shipToLine1: '123 Main St',
  shipToCity: 'Brooklyn',
  shipToRegion: 'NY',
  shipToPostalCode: '11201',
  shipToCountry: 'US',
};

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Co A — Orders' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Orders' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_orders_A',
      email: 'staff-orders@a.test',
      name: 'Staff A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  for (const { company, label } of [
    { company: companyA, label: 'binA1' },
    { company: companyA, label: 'binA2' },
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
    if (label === 'binA1') binA1 = bin;
    if (label === 'binA2') binA2 = bin;
    if (label === 'binB') binB = bin;
  }

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
      name: 'B1 Thing',
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
  status?: StockLevelStatus;
}) {
  const status = args.status ?? StockLevelStatus.AVAILABLE;
  await prisma.stockLevel.upsert({
    where: {
      skuId_binId_status: { skuId: args.skuId, binId: args.binId, status },
    },
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

async function clearAllStockAndOrders() {
  // Tests bypass RLS here — owner role. Order chain cascades from Order
  // deletion; StockLevel is wiped directly.
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.stockLevel.deleteMany({});
}

describe('createOrder + allocation (sufficient stock)', () => {
  it('happy path: one bin, allocates fully → READY_TO_PICK', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 100,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 30 }],
      },
    );

    expect(order.status).toBe(OrderStatus.READY_TO_PICK);
    expect(order.allocatedAt).not.toBeNull();

    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
    });
    expect(allocs).toHaveLength(1);
    expect(allocs[0]!.binId).toBe(binA1.id);
    expect(allocs[0]!.quantityReserved).toBe(30);

    const avail = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    const reserved = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(avail!.quantity).toBe(70);
    expect(reserved!.quantity).toBe(30);
  });

  it('FIFO across multiple bins: older bin drained first', async () => {
    await clearAllStockAndOrders();
    // Seed binA1 first (older) then binA2 (newer)
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 20,
    });
    // Ensure ordering separation
    await new Promise((r) => setTimeout(r, 10));
    await setStock({
      skuId: skuA1Red.id,
      binId: binA2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 30,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 40 }],
      },
    );

    expect(order.status).toBe(OrderStatus.READY_TO_PICK);
    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
      orderBy: { binId: 'asc' },
    });
    expect(allocs).toHaveLength(2);
    const byBin = Object.fromEntries(allocs.map((a) => [a.binId, a.quantityReserved]));
    expect(byBin[binA1.id]).toBe(20); // drained
    expect(byBin[binA2.id]).toBe(20); // partial
  });
});

describe('createOrder + allocation (insufficient stock)', () => {
  it('atomic: lands in AWAITING_STOCK with zero side effects', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 10,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 50 }],
      },
    );

    expect(order.status).toBe(OrderStatus.AWAITING_STOCK);
    expect(order.allocatedAt).toBeNull();

    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
    });
    expect(allocs).toHaveLength(0);

    const stock = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(stock!.quantity).toBe(10);
    const reserved = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(reserved).toBeNull();
  });

  it('multi-line: one line short means whole order awaits, nothing allocated', async () => {
    await clearAllStockAndOrders();
    // Plenty of RED, none of BLUE
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 100,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [
          { skuId: skuA1Red.id, quantity: 5 },
          { skuId: skuA1Blue.id, quantity: 1 },
        ],
      },
    );

    expect(order.status).toBe(OrderStatus.AWAITING_STOCK);
    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
    });
    expect(allocs).toHaveLength(0);

    const red = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(red!.quantity).toBe(100); // untouched
  });
});

describe('allocateOrder retry', () => {
  it('AWAITING_STOCK → READY_TO_PICK after restock', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 20 }],
      },
    );
    expect(order.status).toBe(OrderStatus.AWAITING_STOCK);

    // Restock — bump to 25
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 25,
    });

    const after = await allocateOrder({ companyId: companyA.id, clientId: clientA1.id }, order.id);
    expect(after.status).toBe(OrderStatus.READY_TO_PICK);
    expect(after.allocatedAt).not.toBeNull();

    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: after.lines.map((l) => l.id) } },
    });
    expect(allocs.reduce((s, a) => s + a.quantityReserved, 0)).toBe(20);
  });
});

describe('cancelOrder', () => {
  it('from READY_TO_PICK returns stock exactly', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 50,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 20 }],
      },
    );
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);

    const cancelled = await cancelOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      order.id,
    );
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(cancelled.cancelledAt).not.toBeNull();

    const avail = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    const reserved = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(avail!.quantity).toBe(50);
    expect(reserved!.quantity).toBe(0);

    const allocs = await prisma.orderLineAllocation.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
    });
    expect(allocs).toHaveLength(0);
  });

  it('from AWAITING_STOCK is a clean status flip — no stock movement', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 1,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 100 }],
      },
    );
    expect(order.status).toBe(OrderStatus.AWAITING_STOCK);

    const cancelled = await cancelOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      order.id,
    );
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    const avail = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(avail!.quantity).toBe(1);
  });
});

describe('state machine — illegal transitions', () => {
  it('rejects cancel on a SHIPPED order', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });
    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );

    // Force the order to SHIPPED via the owner client (bypasses transition layer
    // — only acceptable inside a test that's deliberately probing illegal moves).
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SHIPPED },
    });

    await expect(
      cancelOrder({ companyId: companyA.id, clientId: clientA1.id }, order.id),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
  });
});

describe('two-level RLS', () => {
  it('portal cannot see another client’s orders', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });
    await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );

    // Query as client A2 — should see none.
    const rows = await listOrders({ companyId: companyA.id, clientId: clientA2.id });
    expect(rows).toHaveLength(0);
  });

  it('staff sees all clients’ orders in their company', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });
    await setStock({
      skuId: skuA2Green.id,
      binId: binA1.id,
      clientId: clientA2.id,
      companyId: companyA.id,
      quantity: 5,
    });
    await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );
    await createOrder(
      { companyId: companyA.id, clientId: clientA2.id },
      {
        clientId: clientA2.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA2Green.id, quantity: 1 }],
      },
    );

    const rows = await listOrders({ companyId: companyA.id });
    const clientNames = new Set(rows.map((r) => r.clientName));
    expect(clientNames.has('A1')).toBe(true);
    expect(clientNames.has('A2')).toBe(true);
  });
});

describe('cross-tenant isolation', () => {
  it('Company A staff cannot see Company B orders', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuB1.id,
      binId: binB.id,
      clientId: clientB1.id,
      companyId: companyB.id,
      quantity: 10,
    });

    const orderB = await createOrder(
      { companyId: companyB.id, clientId: clientB1.id },
      {
        clientId: clientB1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuB1.id, quantity: 2 }],
      },
    );

    const fromA = await listOrders({ companyId: companyA.id });
    expect(fromA.find((r) => r.id === orderB.id)).toBeUndefined();

    const fromB = await listOrders({ companyId: companyB.id });
    expect(fromB.find((r) => r.id === orderB.id)).toBeDefined();
  });
});

describe('inventory view integration', () => {
  it('listInventoryBySku reflects RESERVED after allocation', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 60,
    });

    await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 25 }],
      },
    );

    const rows = await listInventoryBySku({ companyId: companyA.id });
    const row = rows.find((r) => r.skuCode === 'A1-RED');
    expect(row).toBeDefined();
    expect(row!.available).toBe(35);
    expect(row!.reserved).toBe(25);
    expect(row!.total).toBe(60);
  });
});

describe('staff createOrder audit trail', () => {
  it('records createdByUserId when staff places the order', async () => {
    await clearAllStockAndOrders();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });

    const order = await createOrder(
      { companyId: companyA.id }, // staff context — no clientId
      {
        clientId: clientA1.id,
        createdByUserId: staffUserA.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );

    const detail = await getOrder({ companyId: companyA.id }, order.id);
    expect(detail.createdByUserId).toBe(staffUserA.id);
    expect(detail.createdByClientUserId).toBeNull();
  });
});
