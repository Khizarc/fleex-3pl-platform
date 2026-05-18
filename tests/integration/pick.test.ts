// Integration tests for the pick flow (Milestone 1.8).
// Tests prove:
//   - Per-allocation pick decrements RESERVED and flips order status correctly
//   - Bin label compare is trim + case-insensitive
//   - Double-pick race is rejected by the updateMany guard
//   - Concurrent-final-allocation race is serialized by SELECT FOR UPDATE
//   - Cancel-during-PICKING remains illegal (regression for 1.5)
//   - Disabled bin guard
//   - Two-level RLS + cross-tenant isolation

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountStatus, OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  AllocationAlreadyPickedError,
  BinLabelMismatchError,
  BinNotActiveError,
  IllegalStateTransitionError,
  cancelOrder,
  createOrder,
  listPickQueue,
  pickAllocation,
} from '@/features/orders';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };
let binA1: { id: string; label: string };
let binA2: { id: string; label: string };
let binB: { id: string; label: string };
let skuA1Red: { id: string; code: string };
let skuB1: { id: string; code: string };
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

  companyA = await prisma.company.create({ data: { name: 'Co A — Pick' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Pick' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_pick_A',
      email: 'staff-pick@a.test',
      name: 'Staff A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  // Build a warehouse with 2 bins for company A, 1 bin for company B.
  for (const { company, label, set } of [
    { company: companyA, label: 'binA1', set: 'A1' },
    { company: companyA, label: 'binA2', set: 'A2' },
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
    if (set === 'A2') binA2 = bin;
    if (set === 'B') binB = bin;
  }

  // SKUs
  const productA1 = await prisma.product.create({
    data: { name: 'A1 Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuA1Red = (await prisma.sKU.create({
    data: {
      code: 'PICK-A1',
      name: 'A1',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };

  const productB1 = await prisma.product.create({
    data: { name: 'B1 Thing', clientId: clientB1.id, companyId: companyB.id },
  });
  skuB1 = (await prisma.sKU.create({
    data: {
      code: 'PICK-B1',
      name: 'B1',
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
  // Restore bin active state (some tests disable it)
  await prisma.bin.updateMany({ data: { status: AccountStatus.ACTIVE } });
}

describe('pickAllocation — happy path', () => {
  it('single allocation: pick correct label → order PICKED + RESERVED to 0 + audit set', async () => {
    await reset();
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
        lines: [{ skuId: skuA1Red.id, quantity: 4 }],
      },
    );
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);

    const alloc = order.lines[0]!.allocations[0]!;
    const picked = await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: alloc.id,
        scannedBinLabel: binA1.label,
        pickedByUserId: staffUserA.id,
      },
    );

    expect(picked.pickedAt).not.toBeNull();
    expect(picked.pickedByUserId).toBe(staffUserA.id);

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after!.status).toBe(OrderStatus.PICKED);

    const reserved = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(reserved!.quantity).toBe(0);
  });

  it('multi-allocation walk: PICKING after first, PICKED after last', async () => {
    await reset();
    // Two bins; place enough stock to force FIFO allocation across both.
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 3,
    });
    await new Promise((r) => setTimeout(r, 10));
    await setStock({
      skuId: skuA1Red.id,
      binId: binA2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 5,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 6 }],
      },
    );
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);

    const allocs = order.lines[0]!.allocations;
    expect(allocs).toHaveLength(2);

    // Pick first
    await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: allocs[0]!.id,
        scannedBinLabel: allocs[0]!.binId === binA1.id ? binA1.label : binA2.label,
        pickedByUserId: staffUserA.id,
      },
    );
    let cur = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cur!.status).toBe(OrderStatus.PICKING);

    // Pick second
    await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: allocs[1]!.id,
        scannedBinLabel: allocs[1]!.binId === binA1.id ? binA1.label : binA2.label,
        pickedByUserId: staffUserA.id,
      },
    );
    cur = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cur!.status).toBe(OrderStatus.PICKED);
  });
});

describe('pickAllocation — bin label compare', () => {
  it('rejects on mismatch; no writes; status unchanged', async () => {
    await reset();
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
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );
    const alloc = order.lines[0]!.allocations[0]!;
    await expect(
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: alloc.id,
          scannedBinLabel: 'WRONG-BIN',
          pickedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toBeInstanceOf(BinLabelMismatchError);

    const after = await prisma.orderLineAllocation.findUnique({ where: { id: alloc.id } });
    expect(after!.pickedAt).toBeNull();
    const cur = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cur!.status).toBe(OrderStatus.READY_TO_PICK);
  });

  it('accepts trim + case-insensitive variants', async () => {
    await reset();
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
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );
    const alloc = order.lines[0]!.allocations[0]!;
    const variant = `  ${binA1.label.toUpperCase()}  `;
    const picked = await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: alloc.id,
        scannedBinLabel: variant,
        pickedByUserId: staffUserA.id,
      },
    );
    expect(picked.pickedAt).not.toBeNull();
  });
});

describe('pickAllocation — double-pick guard', () => {
  it('second pick on the same allocation throws AllocationAlreadyPickedError (order still PICKING)', async () => {
    // Multi-allocation setup so the order stays PICKING after the first pick;
    // otherwise the order would already be PICKED and the status guard would
    // fire before the updateMany guard.
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 2,
    });
    await new Promise((r) => setTimeout(r, 10));
    await setStock({
      skuId: skuA1Red.id,
      binId: binA2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 2,
    });
    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 3 }],
      },
    );
    const allocs = order.lines[0]!.allocations;
    expect(allocs).toHaveLength(2);
    const target = allocs[0]!;
    const targetLabel = target.binId === binA1.id ? binA1.label : binA2.label;

    await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: target.id,
        scannedBinLabel: targetLabel,
        pickedByUserId: staffUserA.id,
      },
    );
    // Order is now PICKING (one of two allocations done) — second pick on
    // the SAME allocation must trip the updateMany guard, not the status guard.
    await expect(
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: target.id,
          scannedBinLabel: targetLabel,
          pickedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toBeInstanceOf(AllocationAlreadyPickedError);
  });
});

describe('pickAllocation — concurrent final allocations', () => {
  it('two parallel picks on the last two allocations both succeed; status flips once', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 4,
    });
    await new Promise((r) => setTimeout(r, 10));
    await setStock({
      skuId: skuA1Red.id,
      binId: binA2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 4,
    });

    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 6 }],
      },
    );
    const allocs = order.lines[0]!.allocations;
    expect(allocs).toHaveLength(2);

    const labelFor = (binId: string) => (binId === binA1.id ? binA1.label : binA2.label);

    const [r1, r2] = await Promise.all([
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: allocs[0]!.id,
          scannedBinLabel: labelFor(allocs[0]!.binId),
          pickedByUserId: staffUserA.id,
        },
      ),
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: allocs[1]!.id,
          scannedBinLabel: labelFor(allocs[1]!.binId),
          pickedByUserId: staffUserA.id,
        },
      ),
    ]);
    expect(r1.pickedAt).not.toBeNull();
    expect(r2.pickedAt).not.toBeNull();

    const cur = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cur!.status).toBe(OrderStatus.PICKED);

    // RESERVED rows on both bins should be at 0; no negative.
    const reservedA = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    const reservedB = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA1Red.id,
          binId: binA2.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(reservedA!.quantity).toBeGreaterThanOrEqual(0);
    expect(reservedB!.quantity).toBeGreaterThanOrEqual(0);
    expect(reservedA!.quantity + reservedB!.quantity).toBe(0);
  });
});

describe('cancel-during-PICKING is illegal', () => {
  it('once PICKING starts, cancelOrder throws IllegalStateTransitionError', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 2,
    });
    await new Promise((r) => setTimeout(r, 10));
    await setStock({
      skuId: skuA1Red.id,
      binId: binA2.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 2,
    });
    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 3 }],
      },
    );
    // Pick only first allocation → status = PICKING
    const firstAlloc = order.lines[0]!.allocations[0]!;
    await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: firstAlloc.id,
        scannedBinLabel: firstAlloc.binId === binA1.id ? binA1.label : binA2.label,
        pickedByUserId: staffUserA.id,
      },
    );
    const cur = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cur!.status).toBe(OrderStatus.PICKING);

    await expect(
      cancelOrder({ companyId: companyA.id, clientId: clientA1.id }, order.id),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
  });
});

describe('cancel from READY_TO_PICK still works (regression)', () => {
  it('cancel a freshly allocated order returns stock and flips to CANCELLED', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 3,
    });
    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 2 }],
      },
    );
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);
    const cancelled = await cancelOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      order.id,
    );
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  });
});

describe('disabled bin guard', () => {
  it('cannot pick from a bin whose status is not ACTIVE', async () => {
    await reset();
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
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );
    const alloc = order.lines[0]!.allocations[0]!;

    await prisma.bin.update({
      where: { id: binA1.id },
      data: { status: AccountStatus.DISABLED },
    });

    await expect(
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: alloc.id,
          scannedBinLabel: binA1.label,
          pickedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toBeInstanceOf(BinNotActiveError);
  });
});

describe('two-level RLS', () => {
  it('portal context cannot see the pick queue (returns empty)', async () => {
    await reset();
    await setStock({
      skuId: skuA1Red.id,
      binId: binA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
      quantity: 1,
    });
    await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1Red.id, quantity: 1 }],
      },
    );
    // Same client context — should still see own orders in queue (queue is a
    // staff thing but RLS would also let portal-self read; the real isolation
    // test is the *other* client below).
    const otherClient = await listPickQueue({ companyId: companyA.id, clientId: clientA2.id });
    expect(otherClient).toHaveLength(0);
  });
});

describe('cross-tenant isolation', () => {
  it('Company A staff cannot pick a Company B allocation', async () => {
    await reset();
    // Build a B-order to get an allocation
    await prisma.stockLevel.create({
      data: {
        skuId: skuB1.id,
        binId: binB.id,
        status: StockLevelStatus.AVAILABLE,
        quantity: 5,
        clientId: clientB1.id,
        companyId: companyB.id,
      },
    });
    const orderB = await createOrder(
      { companyId: companyB.id, clientId: clientB1.id },
      {
        clientId: clientB1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuB1.id, quantity: 1 }],
      },
    );
    const allocB = orderB.lines[0]!.allocations[0]!;

    await expect(
      pickAllocation(
        { companyId: companyA.id },
        {
          allocationId: allocB.id,
          scannedBinLabel: binB.label,
          pickedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toThrow();
  });
});
