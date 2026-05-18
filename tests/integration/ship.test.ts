// Integration tests for the ship flow (Milestone 1.10).
// Tests prove:
//   - PACKED → SHIPPED with carrier + tracking + audit fields set
//   - Wrong starting status → IllegalStateTransitionError
//   - Concurrent ship race: exactly one wins via updateMany status guard
//   - Carrier=OTHER requires carrierOther; carrier=known nulls carrierOther
//   - Two-level RLS + cross-tenant isolation
//   - Audit FK is SetNull on user delete; Order survives
//   - 1.9 pack fields (packedAt, boxLengthMm, etc.) untouched through ship

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Carrier, OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  IllegalStateTransitionError,
  OrderAlreadyShippedError,
  createOrder,
  listShipQueue,
  packOrder,
  pickAllocation,
  shipOrder,
  shipOrderInputSchema,
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

  companyA = await prisma.company.create({ data: { name: 'Co A — Ship' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Ship' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_ship_A',
      email: 'staff-ship@a.test',
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
      code: 'SHIP-A1',
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
      code: 'SHIP-B1',
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

// Helper: create an order, pick all allocations, pack it. Returns the order id.
async function createPackedOrder(qty = 1): Promise<string> {
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
  await packOrder(
    { companyId: companyA.id },
    {
      orderId: order.id,
      boxLengthMm: 254,
      boxWidthMm: 203,
      boxHeightMm: 152,
      boxWeightG: 680,
      packedByUserId: staffUserA.id,
    },
  );
  return order.id;
}

describe('shipOrder — happy path', () => {
  it('PACKED order → shipOrder with USPS flips to SHIPPED with all fields set', async () => {
    await reset();
    const orderId = await createPackedOrder(1);

    const before = await prisma.order.findUnique({ where: { id: orderId } });
    expect(before!.status).toBe(OrderStatus.PACKED);

    const shipped = await shipOrder(
      { companyId: companyA.id },
      {
        orderId,
        carrier: Carrier.USPS,
        trackingNumber: '9405511899223197428490',
        shipNotes: 'Handed to mail carrier 3pm',
        shippedByUserId: staffUserA.id,
      },
    );

    expect(shipped.status).toBe(OrderStatus.SHIPPED);
    expect(shipped.shippedAt).not.toBeNull();
    expect(shipped.shippedByUserId).toBe(staffUserA.id);
    expect(shipped.carrier).toBe(Carrier.USPS);
    expect(shipped.carrierOther).toBeNull();
    expect(shipped.trackingNumber).toBe('9405511899223197428490');
    expect(shipped.shipNotes).toBe('Handed to mail carrier 3pm');
  });
});

describe('shipOrder — wrong status', () => {
  it('shipping a READY_TO_PICK order throws IllegalStateTransitionError', async () => {
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
      shipOrder(
        { companyId: companyA.id },
        {
          orderId: order.id,
          carrier: Carrier.USPS,
          trackingNumber: 'TRK-1',
          shippedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
  });
});

describe('shipOrderInputSchema — refines + caps', () => {
  it('rejects tracking number over 120 chars', () => {
    const result = shipOrderInputSchema.safeParse({
      orderId: 'x',
      carrier: Carrier.USPS,
      trackingNumber: 'A'.repeat(121),
    });
    expect(result.success).toBe(false);
  });
  it('rejects empty tracking number', () => {
    const result = shipOrderInputSchema.safeParse({
      orderId: 'x',
      carrier: Carrier.USPS,
      trackingNumber: '   ',
    });
    expect(result.success).toBe(false);
  });
  it('rejects OTHER without carrierOther', () => {
    const result = shipOrderInputSchema.safeParse({
      orderId: 'x',
      carrier: Carrier.OTHER,
      trackingNumber: 'TRK',
    });
    expect(result.success).toBe(false);
  });
  it('accepts OTHER with carrierOther', () => {
    const result = shipOrderInputSchema.safeParse({
      orderId: 'x',
      carrier: Carrier.OTHER,
      carrierOther: 'Custom Courier',
      trackingNumber: 'TRK',
    });
    expect(result.success).toBe(true);
  });
});

describe('shipOrder — concurrent race', () => {
  it('two parallel shipOrder calls on the same PACKED order: exactly one wins', async () => {
    await reset();
    const orderId = await createPackedOrder(1);

    const args = {
      orderId,
      carrier: Carrier.UPS,
      trackingNumber: 'TRK-RACE',
      shippedByUserId: staffUserA.id,
    };
    const results = await Promise.allSettled([
      shipOrder({ companyId: companyA.id }, args),
      shipOrder({ companyId: companyA.id }, args),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(
      reason instanceof IllegalStateTransitionError || reason instanceof OrderAlreadyShippedError,
    ).toBe(true);
  });
});

describe('shipOrder — server-side carrierOther cleanup', () => {
  it('carrier=OTHER with carrierOther persists both fields', async () => {
    await reset();
    const orderId = await createPackedOrder(1);
    const shipped = await shipOrder(
      { companyId: companyA.id },
      {
        orderId,
        carrier: Carrier.OTHER,
        carrierOther: 'Custom Courier',
        trackingNumber: 'CC-100',
        shippedByUserId: staffUserA.id,
      },
    );
    expect(shipped.carrier).toBe(Carrier.OTHER);
    expect(shipped.carrierOther).toBe('Custom Courier');
  });

  it('carrier=USPS with smuggled carrierOther → null in DB', async () => {
    await reset();
    const orderId = await createPackedOrder(1);
    const shipped = await shipOrder(
      { companyId: companyA.id },
      {
        orderId,
        carrier: Carrier.USPS,
        carrierOther: 'this should be nulled',
        trackingNumber: 'TRK-USPS',
        shippedByUserId: staffUserA.id,
      },
    );
    expect(shipped.carrier).toBe(Carrier.USPS);
    expect(shipped.carrierOther).toBeNull();
  });
});

describe('listShipQueue + RLS', () => {
  it('returns PACKED orders for staff context', async () => {
    await reset();
    await createPackedOrder(1);
    const queue = await listShipQueue({ companyId: companyA.id });
    expect(queue.length).toBe(1);
    expect(queue[0]!.status).toBe(OrderStatus.PACKED);
  });

  it('portal A2 context cannot see another client’s ship queue', async () => {
    await reset();
    await createPackedOrder(1);
    const queueA2 = await listShipQueue({
      companyId: companyA.id,
      clientId: clientA2.id,
    });
    expect(queueA2).toHaveLength(0);
  });
});

describe('cross-tenant isolation', () => {
  it('Company A staff cannot ship a Company B order', async () => {
    await reset();
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
      const staffB = await prisma.user.create({
        data: {
          authProviderId: `clerk_staff_ship_B_${alloc.id}`,
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
    await packOrder(
      { companyId: companyB.id },
      {
        orderId: orderB.id,
        boxLengthMm: 200,
        boxWidthMm: 200,
        boxHeightMm: 200,
        boxWeightG: 500,
        packedByUserId: (await prisma.user.findFirst({ where: { companyId: companyB.id } }))!.id,
      },
    );

    await expect(
      shipOrder(
        { companyId: companyA.id },
        {
          orderId: orderB.id,
          carrier: Carrier.UPS,
          trackingNumber: 'TRK-XTENANT',
          shippedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toThrow();
  });
});

describe('audit + SetNull on user delete', () => {
  it('deleting the shipper User SetNulls shippedByUserId; Order survives', async () => {
    await reset();
    const orderId = await createPackedOrder(1);

    const tempShipper = await prisma.user.create({
      data: {
        authProviderId: 'clerk_temp_shipper',
        email: 'temp-shipper@a.test',
        name: 'Temp Shipper',
        role: Role.SHIPPER,
        companyId: companyA.id,
      },
    });

    await shipOrder(
      { companyId: companyA.id },
      {
        orderId,
        carrier: Carrier.FEDEX,
        trackingNumber: 'FEDEX-1',
        shippedByUserId: tempShipper.id,
      },
    );

    await prisma.user.delete({ where: { id: tempShipper.id } });

    const after = await prisma.order.findUnique({ where: { id: orderId } });
    expect(after).not.toBeNull();
    expect(after!.status).toBe(OrderStatus.SHIPPED);
    expect(after!.shippedByUserId).toBeNull();
  });
});

describe('pack fields unchanged through ship', () => {
  it('packedAt + box dims survive shipOrder', async () => {
    await reset();
    const orderId = await createPackedOrder(1);

    const before = await prisma.order.findUnique({ where: { id: orderId } });
    expect(before!.packedAt).not.toBeNull();
    expect(before!.boxLengthMm).toBe(254);

    await shipOrder(
      { companyId: companyA.id },
      {
        orderId,
        carrier: Carrier.DHL,
        trackingNumber: 'DHL-1',
        shippedByUserId: staffUserA.id,
      },
    );

    const after = await prisma.order.findUnique({ where: { id: orderId } });
    expect(after!.packedAt!.getTime()).toBe(before!.packedAt!.getTime());
    expect(after!.boxLengthMm).toBe(254);
    expect(after!.boxWidthMm).toBe(203);
    expect(after!.boxHeightMm).toBe(152);
    expect(after!.boxWeightG).toBe(680);
    expect(after!.packedByUserId).toBe(staffUserA.id);
  });
});
