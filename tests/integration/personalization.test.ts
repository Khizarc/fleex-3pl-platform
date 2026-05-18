// Integration tests for personalization (Milestone 1.7).
// Tests prove:
//   - CRUD on PersonalizationField under two-level RLS + cross-tenant isolation
//   - createOrder validates + writes OrderLinePersonalization atomically
//   - Required field enforcement; unknown key rejection; optional empty skipping
//   - Soft-delete preserves historical values; blocks new captures

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountStatus, OrderStatus, Role, StockLevelStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createOrder, getOrder } from '@/features/orders';
import {
  createPersonalizationField,
  disablePersonalizationField,
  listActivePersonalizationFields,
  listPersonalizationFields,
  updatePersonalizationField,
} from '@/features/personalization';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };
let binA1: { id: string };
let skuA1: { id: string; code: string };
let skuB1: { id: string; code: string };

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

  companyA = await prisma.company.create({ data: { name: 'Co A — Pers' } });
  companyB = await prisma.company.create({ data: { name: 'Co B — Pers' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });

  await prisma.user.create({
    data: {
      authProviderId: 'clerk_staff_pers_A',
      email: 'staff-pers@a.test',
      name: 'Staff A',
      role: Role.ADMIN,
      companyId: companyA.id,
    },
  });

  const whA = await prisma.warehouse.create({
    data: { name: 'Pers-DC', companyId: companyA.id },
  });
  const zoneA = await prisma.zone.create({
    data: { name: 'Z', warehouseId: whA.id, companyId: companyA.id },
  });
  const aisleA = await prisma.aisle.create({
    data: { name: 'A', zoneId: zoneA.id, companyId: companyA.id },
  });
  binA1 = await prisma.bin.create({
    data: { label: 'binA1', aisleId: aisleA.id, companyId: companyA.id },
  });

  const productA1 = await prisma.product.create({
    data: { name: 'A1 Tee', clientId: clientA1.id, companyId: companyA.id },
  });
  skuA1 = (await prisma.sKU.create({
    data: {
      code: 'PERS-A1',
      name: 'A1',
      productId: productA1.id,
      clientId: clientA1.id,
      companyId: companyA.id,
    },
  })) as { id: string; code: string };

  const productA2 = await prisma.product.create({
    data: { name: 'A2 Widget', clientId: clientA2.id, companyId: companyA.id },
  });
  // SKU exists in catalog to anchor clientA2's fixture but isn't referenced
  // by id in the assertions. Created so listPersonalizationFields/RLS tests
  // have a realistic per-client world to query against.
  await prisma.sKU.create({
    data: {
      code: 'PERS-A2',
      name: 'A2',
      productId: productA2.id,
      clientId: clientA2.id,
      companyId: companyA.id,
    },
  });

  const productB1 = await prisma.product.create({
    data: { name: 'B1 Thing', clientId: clientB1.id, companyId: companyB.id },
  });
  skuB1 = (await prisma.sKU.create({
    data: {
      code: 'PERS-B1',
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

async function setStock(skuId: string, qty: number, clientId: string) {
  await prisma.stockLevel.upsert({
    where: {
      skuId_binId_status: { skuId, binId: binA1.id, status: StockLevelStatus.AVAILABLE },
    },
    create: {
      skuId,
      binId: binA1.id,
      status: StockLevelStatus.AVAILABLE,
      quantity: qty,
      clientId,
      companyId: companyA.id,
    },
    update: { quantity: qty },
  });
}

async function reset() {
  await prisma.orderLinePersonalization.deleteMany({});
  await prisma.orderLineAllocation.deleteMany({});
  await prisma.orderLineItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.stockLevel.deleteMany({});
  await prisma.personalizationField.deleteMany({});
}

describe('PersonalizationField CRUD + RLS', () => {
  it('CRUD round-trip: create → list → update label → disable flips status', async () => {
    await reset();
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };

    const created = await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'engraving_text',
      label: 'Engraving',
      required: true,
    });
    expect(created.status).toBe(AccountStatus.ACTIVE);
    expect(created.required).toBe(true);

    const all = await listPersonalizationFields(portalCtx);
    expect(all.map((f) => f.key)).toEqual(['engraving_text']);

    const updated = await updatePersonalizationField(portalCtx, created.id, {
      label: 'Engraving Text',
    });
    expect(updated.label).toBe('Engraving Text');

    const disabled = await disablePersonalizationField(portalCtx, created.id);
    expect(disabled.status).toBe(AccountStatus.DISABLED);

    const activeOnly = await listActivePersonalizationFields(portalCtx);
    expect(activeOnly).toHaveLength(0);
  });

  it('portal A1 cannot see another client’s definitions', async () => {
    await reset();
    await createPersonalizationField(
      { companyId: companyA.id, clientId: clientA2.id },
      { clientId: clientA2.id, key: 'note', label: 'Note' },
    );
    const a1 = await listPersonalizationFields({
      companyId: companyA.id,
      clientId: clientA1.id,
    });
    expect(a1).toHaveLength(0);
  });

  it('staff in company A sees all clients’ definitions in their company', async () => {
    await reset();
    await createPersonalizationField(
      { companyId: companyA.id, clientId: clientA1.id },
      { clientId: clientA1.id, key: 'a1_field', label: 'A1' },
    );
    await createPersonalizationField(
      { companyId: companyA.id, clientId: clientA2.id },
      { clientId: clientA2.id, key: 'a2_field', label: 'A2' },
    );
    const staffView = await listPersonalizationFields({ companyId: companyA.id });
    expect(staffView.map((f) => f.key).sort()).toEqual(['a1_field', 'a2_field']);
  });

  it('Company A cannot see Company B definitions', async () => {
    await reset();
    await createPersonalizationField(
      { companyId: companyB.id, clientId: clientB1.id },
      { clientId: clientB1.id, key: 'b_field', label: 'B' },
    );
    const fromA = await listPersonalizationFields({ companyId: companyA.id });
    expect(fromA).toHaveLength(0);
  });
});

describe('createOrder writes personalization', () => {
  it('captures supplied values and getOrder surfaces them', async () => {
    await reset();
    await setStock(skuA1.id, 100, clientA1.id);
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'engraving_text',
      label: 'Engraving',
    });
    await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'gift_note',
      label: 'Gift note',
    });

    const order = await createOrder(portalCtx, {
      clientId: clientA1.id,
      ...SHIP_TO,
      lines: [
        {
          skuId: skuA1.id,
          quantity: 1,
          personalization: {
            engraving_text: 'Happy Birthday!',
            gift_note: 'From Jane',
          },
        },
      ],
    });
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);

    const detail = await getOrder(portalCtx, order.id);
    const values = detail.lines[0]!.personalizations;
    expect(values.map((v) => v.fieldKey).sort()).toEqual(['engraving_text', 'gift_note']);
    const valueByKey = Object.fromEntries(values.map((v) => [v.fieldKey, v.value]));
    expect(valueByKey.engraving_text).toBe('Happy Birthday!');
    expect(valueByKey.gift_note).toBe('From Jane');
  });

  it('rejects missing required field — atomic (no order written)', async () => {
    await reset();
    await setStock(skuA1.id, 100, clientA1.id);
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'engraving_text',
      label: 'Engraving',
      required: true,
    });

    await expect(
      createOrder(portalCtx, {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/required/i);

    const orders = await prisma.order.findMany({});
    expect(orders).toHaveLength(0);
  });

  it('rejects unknown personalization key', async () => {
    await reset();
    await setStock(skuA1.id, 100, clientA1.id);
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'engraving_text',
      label: 'Engraving',
    });

    await expect(
      createOrder(portalCtx, {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [
          {
            skuId: skuA1.id,
            quantity: 1,
            personalization: { engraving_text: 'OK', not_a_field: 'X' },
          },
        ],
      }),
    ).rejects.toThrow(/unknown personalization/i);
  });

  it('skips optional empty values (no row written)', async () => {
    await reset();
    await setStock(skuA1.id, 100, clientA1.id);
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'gift_note',
      label: 'Gift note',
    });

    const order = await createOrder(portalCtx, {
      clientId: clientA1.id,
      ...SHIP_TO,
      lines: [{ skuId: skuA1.id, quantity: 1, personalization: { gift_note: '   ' } }],
    });

    const rows = await prisma.orderLinePersonalization.findMany({
      where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
    });
    expect(rows).toHaveLength(0);
  });
});

describe('soft delete preserves history', () => {
  it('disabling a field after orders exist keeps values readable but blocks new captures', async () => {
    await reset();
    await setStock(skuA1.id, 100, clientA1.id);
    const portalCtx = { companyId: companyA.id, clientId: clientA1.id };
    const field = await createPersonalizationField(portalCtx, {
      clientId: clientA1.id,
      key: 'gift_note',
      label: 'Gift note',
    });

    // Capture a value
    const order = await createOrder(portalCtx, {
      clientId: clientA1.id,
      ...SHIP_TO,
      lines: [{ skuId: skuA1.id, quantity: 1, personalization: { gift_note: 'happy' } }],
    });

    // Disable the field
    await disablePersonalizationField(portalCtx, field.id);

    // Existing order still surfaces the value
    const detail = await getOrder(portalCtx, order.id);
    expect(detail.lines[0]!.personalizations[0]!.value).toBe('happy');

    // New order trying to use the disabled key is rejected (unknown active key)
    await expect(
      createOrder(portalCtx, {
        clientId: clientA1.id,
        ...SHIP_TO,
        lines: [{ skuId: skuA1.id, quantity: 1, personalization: { gift_note: 'X' } }],
      }),
    ).rejects.toThrow(/unknown personalization/i);
  });
});

describe('cross-tenant SKU isolation still applies', () => {
  it('staff in company A cannot create an order referencing company B SKUs even with personalization', async () => {
    await reset();
    // Staff tries to create an order for clientA1 but references a SKU that
    // belongs to clientB1. Should fail before personalization is checked.
    await expect(
      createOrder(
        { companyId: companyA.id },
        {
          clientId: clientA1.id,
          ...SHIP_TO,
          lines: [{ skuId: skuB1.id, quantity: 1 }],
        },
      ),
    ).rejects.toThrow(/do not belong/i);
  });
});
