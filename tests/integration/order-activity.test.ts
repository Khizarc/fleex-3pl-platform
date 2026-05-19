// Integration tests for the order activity feed (Milestone 1.13).
// Proves events derive correctly from timestamp columns + audit users, sorted
// oldest-first, with cancelled appearing only when cancelledAt is set.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Carrier, OrderStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getOrderActivity } from '@/features/orders';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let clientA: { id: string };
let staff: { id: string };

const SHIP_TO = {
  shipToName: 'Test',
  shipToLine1: '1 Main',
  shipToCity: 'NYC',
  shipToRegion: 'NY',
  shipToPostalCode: '10001',
  shipToCountry: 'US',
};

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Co A — Activity' } });
  clientA = await prisma.client.create({ data: { name: 'Acme', companyId: companyA.id } });
  staff = await prisma.user.create({
    data: {
      authProviderId: 'clerk_activity',
      email: 'staff@a.test',
      name: 'Sam Staff',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
});

async function makeOrder(
  opts: Partial<{
    submittedAt: Date;
    allocatedAt: Date;
    packedAt: Date;
    shippedAt: Date;
    cancelledAt: Date;
    status: OrderStatus;
    packedByUserId: string;
    shippedByUserId: string;
    carrier: Carrier;
    trackingNumber: string;
  }> = {},
) {
  return prisma.order.create({
    data: {
      reference: `ACT-${Date.now()}`,
      status: opts.status ?? OrderStatus.SUBMITTED,
      clientId: clientA.id,
      companyId: companyA.id,
      createdByUserId: staff.id,
      submittedAt: opts.submittedAt ?? new Date('2026-05-18T10:00:00Z'),
      allocatedAt: opts.allocatedAt,
      packedAt: opts.packedAt,
      shippedAt: opts.shippedAt,
      cancelledAt: opts.cancelledAt,
      packedByUserId: opts.packedByUserId,
      shippedByUserId: opts.shippedByUserId,
      carrier: opts.carrier,
      trackingNumber: opts.trackingNumber,
      ...SHIP_TO,
    },
  });
}

describe('getOrderActivity', () => {
  it('returns just submitted event for a fresh order', async () => {
    const order = await makeOrder();
    const events = await getOrderActivity({ companyId: companyA.id }, order.id);
    expect(events.length).toBe(1);
    expect(events[0]?.kind).toBe('submitted');
    expect(events[0]?.by).toBe('Sam Staff');
  });

  it('returns submitted + allocated + packed + shipped in chronological order', async () => {
    const order = await makeOrder({
      submittedAt: new Date('2026-05-18T10:00:00Z'),
      allocatedAt: new Date('2026-05-18T10:05:00Z'),
      packedAt: new Date('2026-05-18T11:00:00Z'),
      shippedAt: new Date('2026-05-18T12:00:00Z'),
      packedByUserId: staff.id,
      shippedByUserId: staff.id,
      carrier: Carrier.USPS,
      trackingNumber: '9400111111111111111111',
      status: OrderStatus.SHIPPED,
    });
    const events = await getOrderActivity({ companyId: companyA.id }, order.id);
    expect(events.map((e) => e.kind)).toEqual(['submitted', 'allocated', 'packed', 'shipped']);
    // shipped event includes tracking detail
    const shipped = events.find((e) => e.kind === 'shipped');
    expect(shipped?.detail).toContain('9400111111111111111111');
  });

  it('renders cancelled event when cancelledAt is set', async () => {
    const order = await makeOrder({
      cancelledAt: new Date('2026-05-18T13:00:00Z'),
      status: OrderStatus.CANCELLED,
    });
    const events = await getOrderActivity({ companyId: companyA.id }, order.id);
    expect(events.some((e) => e.kind === 'cancelled')).toBe(true);
  });

  it('returns empty array for non-existent order id', async () => {
    const events = await getOrderActivity({ companyId: companyA.id }, 'no-such-id');
    expect(events).toEqual([]);
  });
});
