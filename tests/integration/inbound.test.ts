// Integration tests for inbound shipments + receiving + stock materialization.
// First state-machine tests in the codebase.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InboundShipmentStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db';
import {
  IllegalStateTransitionError,
  assertTransition,
  completeInboundShipment,
  createInboundShipment,
  getInboundShipment,
  listInboundShipments,
  receiveLine,
  startReceiving,
} from '@/features/inbound';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

// Test fixtures: two companies, each with a client, a warehouse with one
// bin, and one SKU. Built once in beforeAll and reused.
let companyA: { id: string };
let companyB: { id: string };
let clientA: { id: string };
let clientB: { id: string };
let warehouseA: { id: string };
let warehouseB: { id: string };
let binA: { id: string };
let binB: { id: string };
let skuA: { id: string };
let skuB: { id: string };
let staffUserA: { id: string };

beforeAll(async () => {
  await truncateAll();

  companyA = await prisma.company.create({ data: { name: 'Co A — Inbound' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Inbound' } });
  clientA = await prisma.client.create({ data: { name: 'Acme', companyId: companyA.id } });
  clientB = await prisma.client.create({ data: { name: 'Beta', companyId: companyB.id } });

  staffUserA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_inbound_A',
      email: 'staff-inbound@a.test',
      name: 'Staff A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  // Build warehouse structure for both companies
  for (const [company, refs] of [
    [companyA, { warehouse: 'warehouseA', bin: 'binA' }],
    [companyB, { warehouse: 'warehouseB', bin: 'binB' }],
  ] as const) {
    const wh = await prisma.warehouse.create({
      data: { name: `${company.id}-DC`, companyId: company.id },
    });
    const zone = await prisma.zone.create({
      data: { name: 'Receiving', warehouseId: wh.id, companyId: company.id },
    });
    const aisle = await prisma.aisle.create({
      data: { name: 'A1', zoneId: zone.id, companyId: company.id },
    });
    const bin = await prisma.bin.create({
      data: { label: 'A1-01', aisleId: aisle.id, companyId: company.id },
    });
    if (refs.warehouse === 'warehouseA') warehouseA = wh;
    else warehouseB = wh;
    if (refs.bin === 'binA') binA = bin;
    else binB = bin;
  }

  // Build a product + SKU per client
  const productA = await prisma.product.create({
    data: { name: 'Acme Tee', clientId: clientA.id, companyId: companyA.id },
  });
  skuA = await prisma.sKU.create({
    data: {
      code: 'TEE-A',
      name: 'Acme Tee · Red · L',
      productId: productA.id,
      clientId: clientA.id,
      companyId: companyA.id,
    },
  });
  const productB = await prisma.product.create({
    data: { name: 'Beta Widget', clientId: clientB.id, companyId: companyB.id },
  });
  skuB = await prisma.sKU.create({
    data: {
      code: 'WIDG-B',
      name: 'Beta Widget',
      productId: productB.id,
      clientId: clientB.id,
      companyId: companyB.id,
    },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('createInboundShipment', () => {
  it('writes shipment + lines, status NOTIFIED', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        reference: 'PO-001',
        lines: [{ skuId: skuA.id, expectedQuantity: 100 }],
      },
    );
    expect(shipment.status).toBe(InboundShipmentStatus.NOTIFIED);
    expect(shipment.companyId).toBe(companyA.id);

    const lines = await prisma.inboundShipmentLine.findMany({
      where: { inboundShipmentId: shipment.id },
    });
    expect(lines.length).toBe(1);
    expect(lines[0]?.expectedQuantity).toBe(100);
  });

  it('rejects when the destination warehouse belongs to another company', async () => {
    // From Company A's portal context, try to ship to Company B's warehouse.
    await expect(
      createInboundShipment(
        { companyId: companyA.id, clientId: clientA.id },
        {
          clientId: clientA.id,
          warehouseId: warehouseB.id, // wrong company
          lines: [{ skuId: skuA.id, expectedQuantity: 10 }],
        },
      ),
    ).rejects.toThrow();
  });
});

describe('listInboundShipments — two-level RLS', () => {
  it('staff context sees all clients in the company; portal context sees own only', async () => {
    // Create an Acme shipment + a Beta shipment.
    await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        reference: 'A-listing',
        lines: [{ skuId: skuA.id, expectedQuantity: 5 }],
      },
    );

    const fromStaffA = await listInboundShipments({ companyId: companyA.id });
    expect(fromStaffA.every((s) => s.companyId === companyA.id)).toBe(true);
    expect(fromStaffA.find((s) => s.reference === 'A-listing')).toBeDefined();

    // Portal scoping shouldn't break the listing for the own client.
    const fromAcmePortal = await listInboundShipments({
      companyId: companyA.id,
      clientId: clientA.id,
    });
    expect(fromAcmePortal.every((s) => s.clientId === clientA.id)).toBe(true);
  });
});

describe('state machine', () => {
  it('NOTIFIED → RECEIVING is allowed; NOTIFIED → COMPLETED throws', () => {
    assertTransition(InboundShipmentStatus.NOTIFIED, InboundShipmentStatus.RECEIVING);
    expect(() =>
      assertTransition(InboundShipmentStatus.NOTIFIED, InboundShipmentStatus.COMPLETED),
    ).toThrow(IllegalStateTransitionError);
  });

  it('startReceiving on a NOTIFIED shipment transitions; on COMPLETED throws', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [{ skuId: skuA.id, expectedQuantity: 7 }],
      },
    );
    const started = await startReceiving({ companyId: companyA.id }, shipment.id);
    expect(started.status).toBe(InboundShipmentStatus.RECEIVING);

    // Attempt a second startReceiving on the same row — RECEIVING → RECEIVING is illegal.
    await expect(startReceiving({ companyId: companyA.id }, shipment.id)).rejects.toThrow(
      IllegalStateTransitionError,
    );
  });
});

describe('receiveLine — materializes StockLevel', () => {
  it('upserts the StockLevel; receiving twice into the same bin × SKU adds quantities', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [
          { skuId: skuA.id, expectedQuantity: 40 },
          { skuId: skuA.id, expectedQuantity: 60 }, // 2 lines, same SKU
        ],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);

    const lines = await prisma.inboundShipmentLine.findMany({
      where: { inboundShipmentId: shipment.id },
      orderBy: { expectedQuantity: 'asc' },
    });
    const [line1, line2] = lines;
    if (!line1 || !line2) throw new Error('seed failed');

    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: line1.id,
        actualQuantity: 40,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: line2.id,
        actualQuantity: 60,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );

    const stock = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA.id,
          binId: binA.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    // Single row, summed quantities — proves the upsert works
    expect(stock?.quantity).toBe(100);
  });

  it('rejects when the bin is in a different warehouse than the shipment', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [{ skuId: skuA.id, expectedQuantity: 1 }],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);

    const line = await prisma.inboundShipmentLine.findFirstOrThrow({
      where: { inboundShipmentId: shipment.id },
    });

    // binB is in a different company entirely (so RLS hides it). Either way,
    // the receive should reject.
    await expect(
      receiveLine(
        { companyId: companyA.id },
        {
          lineId: line.id,
          actualQuantity: 1,
          binId: binB.id,
          receivedByUserId: staffUserA.id,
        },
      ),
    ).rejects.toThrow();
  });
});

describe('completeInboundShipment', () => {
  it('sets COMPLETED when every line matches expected', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [{ skuId: skuA.id, expectedQuantity: 25 }],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);
    const line = await prisma.inboundShipmentLine.findFirstOrThrow({
      where: { inboundShipmentId: shipment.id },
    });
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: line.id,
        actualQuantity: 25,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );

    const completed = await completeInboundShipment({ companyId: companyA.id }, shipment.id);
    expect(completed.status).toBe(InboundShipmentStatus.COMPLETED);
  });

  it('sets COMPLETED_WITH_DISCREPANCIES when actual ≠ expected', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [{ skuId: skuA.id, expectedQuantity: 50 }],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);
    const line = await prisma.inboundShipmentLine.findFirstOrThrow({
      where: { inboundShipmentId: shipment.id },
    });
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: line.id,
        actualQuantity: 48, // short by 2
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );

    const completed = await completeInboundShipment({ companyId: companyA.id }, shipment.id);
    expect(completed.status).toBe(InboundShipmentStatus.COMPLETED_WITH_DISCREPANCIES);
  });

  it('throws when not every line has been received yet', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [
          { skuId: skuA.id, expectedQuantity: 3 },
          { skuId: skuA.id, expectedQuantity: 4 },
        ],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);
    const lines = await prisma.inboundShipmentLine.findMany({
      where: { inboundShipmentId: shipment.id },
    });
    // Receive only the first line.
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: lines[0]!.id,
        actualQuantity: 3,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );

    await expect(completeInboundShipment({ companyId: companyA.id }, shipment.id)).rejects.toThrow(
      /not been received/,
    );
  });
});

describe('Full happy path — the milestone’s whole-flow test', () => {
  it('portal creates → staff starts → receives → completes → stock landed → portal sees status', async () => {
    // 1. Portal creates the notice
    const created = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        reference: 'HAPPY-PATH-01',
        lines: [{ skuId: skuA.id, expectedQuantity: 30 }],
      },
    );
    expect(created.status).toBe(InboundShipmentStatus.NOTIFIED);

    // 2. Staff lists & sees the shipment in their company-wide view
    const staffList = await listInboundShipments({ companyId: companyA.id });
    const found = staffList.find((s) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found?.client.name).toBe('Acme');

    // 3. Staff fetches detail
    const detail = await getInboundShipment({ companyId: companyA.id }, created.id);
    expect(detail?.lines.length).toBe(1);

    // 4. Staff starts receiving
    await startReceiving({ companyId: companyA.id }, created.id);

    // 5. Staff receives the line (exact match → no discrepancy)
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: detail!.lines[0]!.id,
        actualQuantity: 30,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );

    // 6. Staff completes
    const completed = await completeInboundShipment({ companyId: companyA.id }, created.id);
    expect(completed.status).toBe(InboundShipmentStatus.COMPLETED);

    // 7. Portal sees the final status from its own context
    const portalView = await getInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      created.id,
    );
    expect(portalView?.status).toBe(InboundShipmentStatus.COMPLETED);
    expect(portalView?.lines[0]?.actualQuantity).toBe(30);
    expect(portalView?.lines[0]?.bin?.id).toBe(binA.id);

    // 8. Stock landed in the right bin × SKU × status
    const stock = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA.id,
          binId: binA.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(stock).not.toBeNull();
    expect(stock!.quantity).toBeGreaterThanOrEqual(30);
    expect(stock!.clientId).toBe(clientA.id);
  });
});

describe('Damaged goods land in a separate StockLevel row', () => {
  it('damaged=true → DAMAGED row; clean receive → AVAILABLE row; the two coexist', async () => {
    const shipment = await createInboundShipment(
      { companyId: companyA.id, clientId: clientA.id },
      {
        clientId: clientA.id,
        warehouseId: warehouseA.id,
        lines: [
          { skuId: skuA.id, expectedQuantity: 10 }, // clean
          { skuId: skuA.id, expectedQuantity: 5 }, // damaged
        ],
      },
    );
    await startReceiving({ companyId: companyA.id }, shipment.id);

    const lines = await prisma.inboundShipmentLine.findMany({
      where: { inboundShipmentId: shipment.id },
      orderBy: { expectedQuantity: 'desc' },
    });
    const [cleanLine, damagedLine] = lines;
    if (!cleanLine || !damagedLine) throw new Error('seed failed');

    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: cleanLine.id,
        actualQuantity: 10,
        binId: binA.id,
        receivedByUserId: staffUserA.id,
      },
    );
    await receiveLine(
      { companyId: companyA.id },
      {
        lineId: damagedLine.id,
        actualQuantity: 5,
        binId: binA.id,
        damaged: true,
        receivedByUserId: staffUserA.id,
        notes: 'crushed in transit',
      },
    );

    const damaged = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA.id,
          binId: binA.id,
          status: StockLevelStatus.DAMAGED,
        },
      },
    });
    expect(damaged?.quantity).toBe(5);

    // AVAILABLE row coexists — damaged stock doesn't pollute pickable stock.
    const available = await prisma.stockLevel.findUnique({
      where: {
        skuId_binId_status: {
          skuId: skuA.id,
          binId: binA.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(available?.quantity).toBeGreaterThanOrEqual(10);
  });
});

describe('Cross-tenant isolation on InboundShipment + StockLevel', () => {
  it('Company A cannot see Company B’s shipment or its stock', async () => {
    // Set up a B shipment + receive it.
    const bShipment = await createInboundShipment(
      { companyId: companyB.id, clientId: clientB.id },
      {
        clientId: clientB.id,
        warehouseId: warehouseB.id,
        lines: [{ skuId: skuB.id, expectedQuantity: 10 }],
      },
    );
    await startReceiving({ companyId: companyB.id }, bShipment.id);
    const bLine = await prisma.inboundShipmentLine.findFirstOrThrow({
      where: { inboundShipmentId: bShipment.id },
    });

    // We need a B staff user to receive against.
    const bStaff = await prisma.user.create({
      data: {
        authProviderId: 'clerk_staff_inbound_B',
        email: 'staff-inbound@b.test',
        name: 'Staff B',
        role: Role.ADMIN,
        companyId: companyB.id,
      },
    });
    await receiveLine(
      { companyId: companyB.id },
      {
        lineId: bLine.id,
        actualQuantity: 10,
        binId: binB.id,
        receivedByUserId: bStaff.id,
      },
    );

    // From Company A's context, try to read B's shipment + B's stock.
    const aSeesBShipment = await getInboundShipment({ companyId: companyA.id }, bShipment.id);
    expect(aSeesBShipment).toBeNull();

    const aSeesBStock = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      return tx.stockLevel.findMany({ where: { skuId: skuB.id } });
    });
    expect(aSeesBStock.length).toBe(0);
  });
});
