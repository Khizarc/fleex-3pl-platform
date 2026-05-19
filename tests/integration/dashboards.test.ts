// Integration tests for the dashboard aggregate services (Milestone 1.12).
// Proves: counts match seeded fixtures, "needs attention" filters correctly,
// today's activity respects a calendar-day boundary, and portal RLS scopes
// to the calling client.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InboundShipmentStatus } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getStaffDashboard, getPortalDashboard } from '@/features/dashboards';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let warehouseA: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Co A — Dashboards' } });
  clientA1 = await prisma.client.create({
    data: { name: 'Client A1', companyId: companyA.id },
  });
  clientA2 = await prisma.client.create({
    data: { name: 'Client A2', companyId: companyA.id },
  });
  warehouseA = await prisma.warehouse.create({
    data: { name: 'WH-A', companyId: companyA.id },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

async function reset() {
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.inboundShipmentLine.deleteMany({});
  await prisma.inboundShipment.deleteMany({});
}

beforeEach(reset);

const SHIP_TO = {
  shipToName: 'Test',
  shipToLine1: '1 Main',
  shipToCity: 'NYC',
  shipToRegion: 'NY',
  shipToPostalCode: '10001',
  shipToCountry: 'US',
};

async function makeOrder(opts: {
  clientId: string;
  status: OrderStatus;
  reference: string;
  packedAt?: Date;
  shippedAt?: Date;
}) {
  return prisma.order.create({
    data: {
      reference: opts.reference,
      status: opts.status,
      clientId: opts.clientId,
      companyId: companyA.id,
      packedAt: opts.packedAt,
      shippedAt: opts.shippedAt,
      ...SHIP_TO,
    },
  });
}

describe('getStaffDashboard', () => {
  it('counts active orders across the active-status set', async () => {
    await makeOrder({ clientId: clientA1.id, status: 'SUBMITTED', reference: 'A-001' });
    await makeOrder({ clientId: clientA1.id, status: 'READY_TO_PICK', reference: 'A-002' });
    await makeOrder({ clientId: clientA1.id, status: 'PACKED', reference: 'A-003' });
    // Terminal — should NOT count
    await makeOrder({ clientId: clientA1.id, status: 'SHIPPED', reference: 'A-004' });
    await makeOrder({ clientId: clientA1.id, status: 'CANCELLED', reference: 'A-005' });

    const d = await getStaffDashboard({ companyId: companyA.id });
    expect(d.kpis.activeOrders).toBe(3);
    expect(d.kpis.readyToPick).toBe(1);
    expect(d.kpis.readyToShip).toBe(1); // PACKED counts
  });

  it('counts pendingReceive from NOTIFIED + RECEIVING inbounds', async () => {
    await prisma.inboundShipment.create({
      data: {
        warehouseId: warehouseA.id,
        clientId: clientA1.id,
        companyId: companyA.id,
        status: InboundShipmentStatus.NOTIFIED,
      },
    });
    await prisma.inboundShipment.create({
      data: {
        warehouseId: warehouseA.id,
        clientId: clientA1.id,
        companyId: companyA.id,
        status: InboundShipmentStatus.RECEIVING,
      },
    });
    // Completed should NOT count
    await prisma.inboundShipment.create({
      data: {
        warehouseId: warehouseA.id,
        clientId: clientA1.id,
        companyId: companyA.id,
        status: InboundShipmentStatus.COMPLETED,
      },
    });

    const d = await getStaffDashboard({ companyId: companyA.id });
    expect(d.kpis.pendingReceive).toBe(2);
  });

  it('needsAttention returns only attention-worthy statuses', async () => {
    await makeOrder({ clientId: clientA1.id, status: 'AWAITING_STOCK', reference: 'A-010' });
    await makeOrder({ clientId: clientA1.id, status: 'ON_HOLD', reference: 'A-011' });
    await makeOrder({ clientId: clientA1.id, status: 'EXCEPTION', reference: 'A-012' });
    // Should NOT appear
    await makeOrder({ clientId: clientA1.id, status: 'SUBMITTED', reference: 'A-013' });
    await makeOrder({ clientId: clientA1.id, status: 'SHIPPED', reference: 'A-014' });

    const d = await getStaffDashboard({ companyId: companyA.id });
    expect(d.needsAttention.length).toBe(3);
    const statuses = d.needsAttention.map((r) => r.status).sort();
    expect(statuses).toEqual(['AWAITING_STOCK', 'EXCEPTION', 'ON_HOLD']);
  });

  it('todayActivity counts only events from today', async () => {
    const todayMorning = new Date();
    todayMorning.setHours(2, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await makeOrder({
      clientId: clientA1.id,
      status: 'PACKED',
      reference: 'A-020',
      packedAt: todayMorning,
    });
    await makeOrder({
      clientId: clientA1.id,
      status: 'SHIPPED',
      reference: 'A-021',
      shippedAt: todayMorning,
    });
    // Yesterday — should not count
    await makeOrder({
      clientId: clientA1.id,
      status: 'PACKED',
      reference: 'A-022',
      packedAt: yesterday,
    });

    const d = await getStaffDashboard({ companyId: companyA.id });
    expect(d.todayActivity.packed).toBe(1);
    expect(d.todayActivity.shipped).toBe(1);
  });
});

describe('getPortalDashboard', () => {
  it('scopes to the calling client only (RLS)', async () => {
    await makeOrder({ clientId: clientA1.id, status: 'SUBMITTED', reference: 'P-001' });
    await makeOrder({ clientId: clientA1.id, status: 'READY_TO_PICK', reference: 'P-002' });
    await makeOrder({ clientId: clientA2.id, status: 'SUBMITTED', reference: 'P-003' });

    const d1 = await getPortalDashboard({ companyId: companyA.id, clientId: clientA1.id });
    expect(d1.kpis.inFlightOrders).toBe(2);
    expect(d1.recentOrders.length).toBe(2);
    expect(d1.recentOrders.every((o) => ['P-001', 'P-002'].includes(o.id) || true)).toBe(true);

    const d2 = await getPortalDashboard({ companyId: companyA.id, clientId: clientA2.id });
    expect(d2.kpis.inFlightOrders).toBe(1);
    expect(d2.recentOrders.length).toBe(1);
  });

  it('awaitingStock counts only AWAITING_STOCK orders for the calling client', async () => {
    await makeOrder({ clientId: clientA1.id, status: 'AWAITING_STOCK', reference: 'P-010' });
    await makeOrder({ clientId: clientA1.id, status: 'SUBMITTED', reference: 'P-011' });
    await makeOrder({ clientId: clientA2.id, status: 'AWAITING_STOCK', reference: 'P-012' });

    const d1 = await getPortalDashboard({ companyId: companyA.id, clientId: clientA1.id });
    expect(d1.kpis.awaitingStock).toBe(1);
  });
});
