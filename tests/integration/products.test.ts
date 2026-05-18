// Integration tests for the products service layer. Exercises the two-level
// tenant filter for the first time at the application layer (staff sees all
// clients of a company; client portal user sees only their own client).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { createProduct, createSku, listProducts, listSkus } from '@/features/products';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };
let clientA1: { id: string };
let clientA2: { id: string };
let clientB1: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Company A — Products' } });
  companyB = await prisma.company.create({ data: { name: 'Company B — Products' } });
  clientA1 = await prisma.client.create({ data: { name: 'A1', companyId: companyA.id } });
  clientA2 = await prisma.client.create({ data: { name: 'A2', companyId: companyA.id } });
  clientB1 = await prisma.client.create({ data: { name: 'B1', companyId: companyB.id } });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('createProduct', () => {
  it('writes a row in caller tenant with companyId derived from the client', async () => {
    const product = await createProduct(
      { companyId: companyA.id },
      { clientId: clientA1.id, name: 'Tee', description: 'cotton' },
    );
    expect(product.companyId).toBe(companyA.id);
    expect(product.clientId).toBe(clientA1.id);
  });

  it('rejects when the referenced clientId belongs to another company', async () => {
    // Company A's context, but target Company B's client.
    await expect(
      createProduct({ companyId: companyA.id }, { clientId: clientB1.id, name: 'Stolen Tee' }),
    ).rejects.toThrow();
  });
});

describe('createSku', () => {
  it('derives clientId + companyId from the parent product', async () => {
    const product = await createProduct(
      { companyId: companyA.id },
      { clientId: clientA1.id, name: 'Mug' },
    );
    const sku = await createSku(
      { companyId: companyA.id },
      { productId: product.id, code: 'MUG-RED', name: 'Mug · Red' },
    );
    expect(sku.productId).toBe(product.id);
    expect(sku.clientId).toBe(clientA1.id);
    expect(sku.companyId).toBe(companyA.id);
  });

  it('cross-tenant: rejects targeting another tenant’s product', async () => {
    const productB = await createProduct(
      { companyId: companyB.id },
      { clientId: clientB1.id, name: 'B Tee' },
    );
    // Caller is in Company A's context; product belongs to Company B.
    // RLS hides productB from A → findUniqueOrThrow throws.
    await expect(
      createSku(
        { companyId: companyA.id },
        { productId: productB.id, code: 'BTEE', name: 'B Tee variant' },
      ),
    ).rejects.toThrow();
  });
});

describe('listProducts — two-level RLS', () => {
  it('staff context (no clientId) sees all clients’ products of the company', async () => {
    // Seed: one product per A1 and A2 (created above + new one for A2)
    await createProduct({ companyId: companyA.id }, { clientId: clientA2.id, name: 'A2 Widget' });

    const fromStaff = await listProducts({ companyId: companyA.id });
    const names = fromStaff.map((p) => p.name);
    // Should include products from BOTH A1 and A2 — staff sees everything in their company.
    expect(names).toContain('A2 Widget');
    expect(fromStaff.every((p) => p.companyId === companyA.id)).toBe(true);
  });

  it('client-portal context (clientId set) sees only own-client products', async () => {
    const fromA1Portal = await listProducts({ companyId: companyA.id, clientId: clientA1.id });
    expect(fromA1Portal.every((p) => p.clientId === clientA1.id)).toBe(true);
    expect(fromA1Portal.find((p) => p.name === 'A2 Widget')).toBeUndefined();
  });

  it('cross-tenant SELECT isolation: Company A cannot read Company B’s products', async () => {
    await createProduct(
      { companyId: companyB.id },
      { clientId: clientB1.id, name: 'B-only product' },
    );

    const fromA = await listProducts({ companyId: companyA.id });
    expect(fromA.find((p) => p.name === 'B-only product')).toBeUndefined();
  });

  it('cross-client within-company isolation: client A1 cannot read client A2’s products', async () => {
    const fromA1 = await listProducts({ companyId: companyA.id, clientId: clientA1.id });
    expect(fromA1.find((p) => p.name === 'A2 Widget')).toBeUndefined();
  });
});

describe('listSkus — RLS through the relation', () => {
  it('returns only SKUs of the requested product (RLS-enforced)', async () => {
    const product = await createProduct(
      { companyId: companyA.id },
      { clientId: clientA1.id, name: 'Pen' },
    );
    await createSku(
      { companyId: companyA.id },
      { productId: product.id, code: 'PEN-BLK', name: 'Pen · Black' },
    );
    await createSku(
      { companyId: companyA.id },
      { productId: product.id, code: 'PEN-BLU', name: 'Pen · Blue' },
    );

    const skus = await listSkus({ companyId: companyA.id }, { productId: product.id });
    expect(skus.length).toBe(2);
    expect(skus.map((s) => s.code).sort()).toEqual(['PEN-BLK', 'PEN-BLU']);

    // Same query from client A2 portal context returns nothing (RLS hides
    // the SKUs because product.clientId !== A2).
    const fromA2Portal = await listSkus(
      { companyId: companyA.id, clientId: clientA2.id },
      { productId: product.id },
    );
    expect(fromA2Portal.length).toBe(0);
  });
});
