// Integration tests for the onboarding-progress derived view (Milestone 1.12).
// Proves the 5 checklist booleans flip on/off based on actual tenant state
// and that RLS keeps Company A's progress independent of Company B's data.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InboundShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getOnboardingProgress } from '@/features/onboarding';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Co A — Onboarding' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Onboarding' } });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

async function reset() {
  await prisma.inboundShipmentLine.deleteMany({});
  await prisma.inboundShipment.deleteMany({});
  await prisma.sKU.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.clientUser.deleteMany({});
  await prisma.bin.deleteMany({});
  await prisma.aisle.deleteMany({});
  await prisma.zone.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.client.deleteMany({});
}

beforeEach(reset);

describe('getOnboardingProgress', () => {
  it('returns all false for a fresh company', async () => {
    const progress = await getOnboardingProgress({ companyId: companyA.id });
    expect(progress).toEqual({
      warehouseCreated: false,
      clientCreated: false,
      skuCreated: false,
      clientUserInvited: false,
      inboundReceived: false,
    });
  });

  it('flips warehouseCreated once a Warehouse exists', async () => {
    await prisma.warehouse.create({ data: { name: 'WH', companyId: companyA.id } });
    const progress = await getOnboardingProgress({ companyId: companyA.id });
    expect(progress.warehouseCreated).toBe(true);
    expect(progress.clientCreated).toBe(false);
  });

  it('checks all five steps after a full setup with a received inbound', async () => {
    const wh = await prisma.warehouse.create({
      data: { name: 'WH', companyId: companyA.id },
    });
    const client = await prisma.client.create({
      data: { name: 'Acme', companyId: companyA.id },
    });
    const product = await prisma.product.create({
      data: { name: 'Tee', clientId: client.id, companyId: companyA.id },
    });
    await prisma.sKU.create({
      data: {
        code: 'TEE-1',
        name: 'Tee 1',
        productId: product.id,
        clientId: client.id,
        companyId: companyA.id,
      },
    });
    await prisma.clientUser.create({
      data: {
        email: 'portal@acme.test',
        name: 'Portal User',
        clientId: client.id,
        companyId: companyA.id,
      },
    });
    await prisma.inboundShipment.create({
      data: {
        warehouseId: wh.id,
        clientId: client.id,
        companyId: companyA.id,
        status: InboundShipmentStatus.RECEIVING,
      },
    });

    const progress = await getOnboardingProgress({ companyId: companyA.id });
    expect(progress).toEqual({
      warehouseCreated: true,
      clientCreated: true,
      skuCreated: true,
      clientUserInvited: true,
      inboundReceived: true,
    });
  });

  it('does NOT count NOTIFIED inbound as received (must be RECEIVING+ to flip)', async () => {
    const wh = await prisma.warehouse.create({
      data: { name: 'WH', companyId: companyA.id },
    });
    const client = await prisma.client.create({
      data: { name: 'Acme', companyId: companyA.id },
    });
    await prisma.inboundShipment.create({
      data: {
        warehouseId: wh.id,
        clientId: client.id,
        companyId: companyA.id,
        status: InboundShipmentStatus.NOTIFIED,
      },
    });
    const progress = await getOnboardingProgress({ companyId: companyA.id });
    expect(progress.inboundReceived).toBe(false);
  });

  it('RLS — Company A progress reflects only Company A data', async () => {
    // Seed Company B with everything; Company A stays empty.
    const whB = await prisma.warehouse.create({
      data: { name: 'WH-B', companyId: companyB.id },
    });
    const clientB = await prisma.client.create({
      data: { name: 'BCo', companyId: companyB.id },
    });
    const productB = await prisma.product.create({
      data: { name: 'BTee', clientId: clientB.id, companyId: companyB.id },
    });
    await prisma.sKU.create({
      data: {
        code: 'B-1',
        name: 'B 1',
        productId: productB.id,
        clientId: clientB.id,
        companyId: companyB.id,
      },
    });
    await prisma.inboundShipment.create({
      data: {
        warehouseId: whB.id,
        clientId: clientB.id,
        companyId: companyB.id,
        status: InboundShipmentStatus.RECEIVING,
      },
    });

    const progressA = await getOnboardingProgress({ companyId: companyA.id });
    expect(progressA.warehouseCreated).toBe(false);
    expect(progressA.clientCreated).toBe(false);
    expect(progressA.skuCreated).toBe(false);
    expect(progressA.inboundReceived).toBe(false);

    const progressB = await getOnboardingProgress({ companyId: companyB.id });
    expect(progressB.warehouseCreated).toBe(true);
    expect(progressB.inboundReceived).toBe(true);
  });
});
