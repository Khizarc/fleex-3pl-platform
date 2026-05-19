// Integration tests for the demo-data seed + reset helpers (Milestone 1.13).
// Proves the seed creates the expected shape, hasDemoData is correct, double-seed
// throws DemoDataAlreadyExistsError, reset clears cleanly, and RLS keeps Company A
// from touching Company B's seed.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  DemoDataAlreadyExistsError,
  hasDemoData,
  resetDemoData,
  seedDemoData,
} from '@/features/onboarding';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };
let adminA: { id: string };
let adminB: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Co A — DemoSeed' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — DemoSeed' } });
  adminA = await prisma.user.create({
    data: {
      authProviderId: 'clerk_demo_a',
      email: 'admin@a.demo',
      name: 'Admin A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });
  adminB = await prisma.user.create({
    data: {
      authProviderId: 'clerk_demo_b',
      email: 'admin@b.demo',
      name: 'Admin B',
      role: Role.ADMIN,
      companyId: companyB.id,
    },
  });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDemoData({ companyId: companyA.id });
  await resetDemoData({ companyId: companyB.id });
});

describe('hasDemoData', () => {
  it('returns false for a tenant with no demo seed', async () => {
    expect(await hasDemoData({ companyId: companyA.id })).toBe(false);
  });
});

describe('seedDemoData', () => {
  it('creates the full demo shape — 1 wh, 1 client, 3 products, 6 SKUs, 1 inbound, 1 order', async () => {
    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });

    const wh = await prisma.warehouse.findFirst({ where: { companyId: companyA.id } });
    const bins = await prisma.bin.count({ where: { companyId: companyA.id } });
    const client = await prisma.client.findFirst({ where: { companyId: companyA.id } });
    const products = await prisma.product.count({ where: { companyId: companyA.id } });
    const skus = await prisma.sKU.count({ where: { companyId: companyA.id } });
    const clientUsers = await prisma.clientUser.count({ where: { companyId: companyA.id } });
    const persFields = await prisma.personalizationField.count({
      where: { companyId: companyA.id },
    });
    const inbounds = await prisma.inboundShipment.count({ where: { companyId: companyA.id } });
    const inboundLines = await prisma.inboundShipmentLine.count({
      where: { companyId: companyA.id },
    });
    const stockLevels = await prisma.stockLevel.count({ where: { companyId: companyA.id } });
    const orders = await prisma.order.count({ where: { companyId: companyA.id } });
    const persValues = await prisma.orderLinePersonalization.count({
      where: { companyId: companyA.id },
    });

    expect(wh).not.toBeNull();
    expect(bins).toBe(6);
    expect(client).not.toBeNull();
    expect(products).toBe(3);
    expect(skus).toBe(6);
    expect(clientUsers).toBe(1);
    expect(persFields).toBe(1);
    expect(inbounds).toBe(1);
    expect(inboundLines).toBe(3);
    expect(stockLevels).toBe(3);
    expect(orders).toBe(1);
    expect(persValues).toBe(1);
  });

  it('hasDemoData flips to true after seeding', async () => {
    expect(await hasDemoData({ companyId: companyA.id })).toBe(false);
    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });
    expect(await hasDemoData({ companyId: companyA.id })).toBe(true);
  });

  it('throws DemoDataAlreadyExistsError if called twice', async () => {
    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });
    await expect(
      seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id }),
    ).rejects.toBeInstanceOf(DemoDataAlreadyExistsError);
  });
});

describe('resetDemoData', () => {
  it('removes all demo rows and lets hasDemoData return false again', async () => {
    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });
    expect(await hasDemoData({ companyId: companyA.id })).toBe(true);

    await resetDemoData({ companyId: companyA.id });

    expect(await hasDemoData({ companyId: companyA.id })).toBe(false);
    expect(await prisma.warehouse.count({ where: { companyId: companyA.id } })).toBe(0);
    expect(await prisma.client.count({ where: { companyId: companyA.id } })).toBe(0);
    expect(await prisma.stockLevel.count({ where: { companyId: companyA.id } })).toBe(0);
    expect(await prisma.order.count({ where: { companyId: companyA.id } })).toBe(0);
  });

  it('preserves non-demo rows for the same company', async () => {
    // Pre-existing user-created warehouse.
    const userWh = await prisma.warehouse.create({
      data: { name: 'My Real Warehouse', companyId: companyA.id },
    });

    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });
    await resetDemoData({ companyId: companyA.id });

    const stillThere = await prisma.warehouse.findUnique({ where: { id: userWh.id } });
    expect(stillThere).not.toBeNull();
  });
});

describe('Cross-tenant isolation', () => {
  it("Company A's seed doesn't leak into Company B", async () => {
    await seedDemoData({ companyId: companyA.id }, { receivedByUserId: adminA.id });
    expect(await hasDemoData({ companyId: companyA.id })).toBe(true);
    expect(await hasDemoData({ companyId: companyB.id })).toBe(false);

    // Company B can also seed independently.
    await seedDemoData({ companyId: companyB.id }, { receivedByUserId: adminB.id });
    expect(await hasDemoData({ companyId: companyB.id })).toBe(true);

    // Reset A doesn't touch B.
    await resetDemoData({ companyId: companyA.id });
    expect(await hasDemoData({ companyId: companyA.id })).toBe(false);
    expect(await hasDemoData({ companyId: companyB.id })).toBe(true);
  });
});
