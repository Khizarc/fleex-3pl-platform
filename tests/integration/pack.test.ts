// Integration tests for the pack flow (Milestone 1.9).
// Tests prove:
//   - PICKED → PACKED with box dims + weight + audit fields set
//   - Wrong starting status → IllegalStateTransitionError
//   - Zod sanity caps reject absurd dimensions
//   - Concurrent pack race: exactly one wins via updateMany status guard
//   - Two-level RLS + cross-tenant isolation
//   - Audit FK is SetNull on user delete; Order survives
//   - 1.8 pick fields (pickedAt, pickedByUserId) untouched through pack

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  IllegalStateTransitionError,
  OrderAlreadyPackedError,
  createOrder,
  listPackQueue,
  packOrder,
  packOrderInputSchema,
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
let binB: { id: string; label: string };
let skuA1: { id: string; code: string };
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

  companyA = await prisma.company.create({ data: { name: 'Co A — Pack' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Pack' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_pack_A',
      email: 'staff-pack@a.test',
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
    if (set === 'B') binB = bin;
  }

  const productA1 = await prisma.product.create({
    data: { name: 'A1 Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuA1 = (await prisma.sKU.create({
    data: {
      code: 'PACK-A1',
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
      code: 'PACK-B1',
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

async function setStock(
  skuId: string,
  binId: string,
  clientId: string,
  companyId: string,
  qty: number,
) {
  await prisma.stockLevel.upsert({
    where: {
      skuId_binId_status: { skuId, binId, status: StockLevelStatus.AVAILABLE },
    },
    create: {
      skuId,
      binId,
      status: StockLevelStatus.AVAILABLE,
      quantity: qty,
      clientId,
      companyId,
    },
    update: { quantity: qty },
  });
}

async function reset() {
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.stockLevel.deleteMany({});
}

// Helper: create an order, immediately pick all allocations so it lands in
// PICKED. Returns the order id.
async function createPickedOrder(qty = 2): Promise<string> {
  await setStock(skuA1.id, binA1.id, clientA1.id, companyA.id, 100);
  const order = await createOrder(
    { companyId: companyA.id, clientId: clientA1.id },
    {
      clientId: clientA1.id,
      ...SHIP_TO,
      lines: [{ skuId: skuA1.id, quantity: qty }],
    },
  );
  for (const alloc of order.lines[0]!.allocations) {
    await pickAllocation(
      { companyId: companyA.id },
      {
        allocationId: alloc.id,
        scannedBinLabel: binA1.label,
        pickedByUserId: staffUserA.id,
      },
    );
  }
  return order.id;
}

describe('packOrder — happy path', () => {
  it('PICKED order → packOrder flips to PACKED with all fields set', async () => {
    await reset();
    const orderId = await createPickedOrder(2);

    const before = await prisma.order.findUnique({ where: { id: orderId } });
    expect(before!.status).toBe(OrderStatus.PICKED);

    const packed = await packOrder(
      { companyId: companyA.id },
      {
        orderId,
        boxLengthMm: 254,
        boxWidthMm: 203,
        boxHeightMm: 152,
        boxWeightG: 680,
        packNotes: 'Fragile sticker applied',
        packedByUserId: staffUserA.id,
      },
    );

    expect(packed.status).toBe(OrderStatus.PACKED);
    expect(packed.packedAt).not.toBeNull();
    expect(packed.packedByUserId).toBe(staffUserA.id);
    expect(packed.boxLengthMm).toBe(254);
    expect(packed.boxWidthMm).toBe(203);
    expect(packed.boxHeightMm).toBe(152);
    expect(packed.boxWeightG).toBe(680);
    expect(packed.packNotes).toBe('Fragile sticker applied');
  });
});

describe('packOrder — wrong status', () => {
  it('packing a READY_TO_PICK order throws IllegalStateTransitionError', async () => {
    await reset();
    await setStock(skuA1.id, binA1.id, clientA1.id, companyA.id, 5);
    const order = await createOrder(
      { companyId: companyA.id, clientId: clientA1.id },
      {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1.id, quantity: 1 }],
      },
    );
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);

    await expect(
      packOrder(
        { companyId: companyA.id },
        {
          orderId: order.id,
          boxLengthMm: 100,
          boxWidthMm: 100,
          boxHeightMm: 100,
          boxWeightG: 100,
          packedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
  });
});

describe('packOrderInputSchema sanity caps', () => {
  it('rejects boxLengthMm above 3000', () => {
    const result = packOrderInputSchema.safeParse({
      orderId: 'x',
      boxLengthMm: 999_999,
      boxWidthMm: 100,
      boxHeightMm: 100,
      boxWeightG: 100,
    });
    expect(result.success).toBe(false);
  });
  it('rejects boxWeightG above 500_000', () => {
    const result = packOrderInputSchema.safeParse({
      orderId: 'x',
      boxLengthMm: 100,
      boxWidthMm: 100,
      boxHeightMm: 100,
      boxWeightG: 9_999_999,
    });
    expect(result.success).toBe(false);
  });
  it('rejects zero or negative dimensions', () => {
    expect(
      packOrderInputSchema.safeParse({
        orderId: 'x',
        boxLengthMm: 0,
        boxWidthMm: 100,
        boxHeightMm: 100,
        boxWeightG: 100,
      }).success,
    ).toBe(false);
    expect(
      packOrderInputSchema.safeParse({
        orderId: 'x',
        boxLengthMm: 100,
        boxWidthMm: -5,
        boxHeightMm: 100,
        boxWeightG: 100,
      }).success,
    ).toBe(false);
  });
});

describe('packOrder — concurrent race', () => {
  it('two parallel packOrder calls on the same PICKED order: exactly one wins', async () => {
    await reset();
    const orderId = await createPickedOrder(1);

    const args = {
      orderId,
      boxLengthMm: 200,
      boxWidthMm: 200,
      boxHeightMm: 200,
      boxWeightG: 500,
      packedByUserId: staffUserA.id,
    };
    const results = await Promise.allSettled([
      packOrder({ companyId: companyA.id }, args),
      packOrder({ companyId: companyA.id }, args),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The losing call must throw either IllegalStateTransitionError (saw
    // PACKED under the lock) or OrderAlreadyPackedError (passed status
    // check but updateMany count=0). Both are valid wins-vs-loser outcomes.
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(
      reason instanceof IllegalStateTransitionError || reason instanceof OrderAlreadyPackedError,
    ).toBe(true);
  });
});

describe('listPackQueue + RLS', () => {
  it('returns PICKED orders for staff context', async () => {
    await reset();
    await createPickedOrder(1);
    const queue = await listPackQueue({ companyId: companyA.id });
    expect(queue.length).toBe(1);
    expect(queue[0]!.status).toBe(OrderStatus.PICKED);
  });

  it('portal A2 context cannot see another client’s pack queue', async () => {
    await reset();
    await createPickedOrder(1); // belongs to A1
    const queueA2 = await listPackQueue({
      companyId: companyA.id,
      clientId: clientA2.id,
    });
    expect(queueA2).toHaveLength(0);
  });
});

describe('cross-tenant isolation', () => {
  it('Company A staff cannot pack a Company B order', async () => {
    await reset();
    // Build a B-order and progress it to PICKED.
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
    for (const alloc of orderB.lines[0]!.allocations) {
      // Need a Company B staff user to pick — quick fixture
      const staffB = await prisma.user.create({
        data: {
          authProviderId: `clerk_staff_pack_B_${alloc.id}`,
          email: `${alloc.id}@b.test`,
          name: 'Staff B',
          role: Role.ADMIN,
          companyId: companyB.id,
        },
      });
      await pickAllocation(
        { companyId: companyB.id },
        {
          allocationId: alloc.id,
          scannedBinLabel: binB.label,
          pickedByUserId: staffB.id,
        },
      );
    }

    await expect(
      packOrder(
        { companyId: companyA.id },
        {
          orderId: orderB.id,
          boxLengthMm: 200,
          boxWidthMm: 200,
          boxHeightMm: 200,
          boxWeightG: 500,
          packedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toThrow();
  });
});

describe('audit + SetNull on user delete', () => {
  it('deleting the packer User SetNulls packedByUserId; Order survives', async () => {
    await reset();
    const orderId = await createPickedOrder(1);

    const tempPacker = await prisma.user.create({
      data: {
        authProviderId: 'clerk_temp_packer',
        email: 'temp-packer@a.test',
        name: 'Temp Packer',
        role: Role.PACKER,
        companyId: companyA.id,
      },
    });

    await packOrder(
      { companyId: companyA.id },
      {
        orderId,
        boxLengthMm: 200,
        boxWidthMm: 200,
        boxHeightMm: 200,
        boxWeightG: 500,
        packedByUserId: tempPacker.id,
      },
    );

    await prisma.user.delete({ where: { id: tempPacker.id } });

    const after = await prisma.order.findUnique({ where: { id: orderId } });
    expect(after).not.toBeNull();
    expect(after!.status).toBe(OrderStatus.PACKED);
    expect(after!.packedByUserId).toBeNull();
  });
});

describe('pick fields unchanged through pack', () => {
  it('each OrderLineAllocation pickedAt + pickedByUserId survive packOrder', async () => {
    await reset();
    const orderId = await createPickedOrder(2);

    const before = await prisma.orderLineAllocation.findMany({
      where: { orderLineItem: { orderId } },
      select: { id: true, pickedAt: true, pickedByUserId: true },
    });
    expect(before.length).toBeGreaterThan(0);
    for (const b of before) {
      expect(b.pickedAt).not.toBeNull();
      expect(b.pickedByUserId).toBe(staffUserA.id);
    }

    await packOrder(
      { companyId: companyA.id },
      {
        orderId,
        boxLengthMm: 200,
        boxWidthMm: 200,
        boxHeightMm: 200,
        boxWeightG: 500,
        packedByUserId: staffUserA.id,
      },
    );

    const after = await prisma.orderLineAllocation.findMany({
      where: { orderLineItem: { orderId } },
      select: { id: true, pickedAt: true, pickedByUserId: true },
    });
    const beforeMap = Object.fromEntries(
      before.map((b) => [b.id, { pickedAt: b.pickedAt, pickedByUserId: b.pickedByUserId }]),
    );
    for (const a of after) {
      expect(a.pickedAt!.getTime()).toBe(beforeMap[a.id]!.pickedAt!.getTime());
      expect(a.pickedByUserId).toBe(beforeMap[a.id]!.pickedByUserId);
    }
  });
});
