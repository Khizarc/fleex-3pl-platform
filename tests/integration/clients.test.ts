// Integration tests for the clients service layer + the API-level isolation
// guarantee that closes Phase 0. Exercises the full pipeline through
// `withTenantContext` → RLS → Prisma.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { createClient, listClients } from '@/features/clients';
import { withTenantContext } from '@/lib/db';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

let companyA: { id: string };
let companyB: { id: string };

beforeAll(async () => {
  await truncateAll();
  companyA = await prisma.company.create({ data: { name: 'Company A' } });
  companyB = await prisma.company.create({ data: { name: 'Company B' } });
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('createClient (service)', () => {
  it('creates a Client inside the caller tenant', async () => {
    const created = await createClient({ companyId: companyA.id }, { name: 'Acme Co.' });
    expect(created.name).toBe('Acme Co.');
    expect(created.companyId).toBe(companyA.id);
  });

  it('with firstUser provided: creates Client + unclaimed ClientUser in one transaction', async () => {
    const created = await createClient(
      { companyId: companyA.id },
      {
        name: 'Acme With Invite',
        firstUserEmail: 'invitee-a@acme.test',
        firstUserName: 'Invitee A',
      },
    );
    const clientUser = await prisma.clientUser.findFirst({
      where: { clientId: created.id, email: 'invitee-a@acme.test' },
    });
    expect(clientUser).not.toBeNull();
    expect(clientUser?.authProviderId).toBeNull();
    expect(clientUser?.companyId).toBe(companyA.id);
  });
});

describe('listClients (service)', () => {
  it('returns only the caller tenant’s clients (RLS through service layer)', async () => {
    // Both companies created clients during prior tests + below; seed B-only.
    await createClient({ companyId: companyB.id }, { name: 'Beta Co.' });

    const fromA = await listClients({ companyId: companyA.id });
    const fromB = await listClients({ companyId: companyB.id });

    expect(fromA.every((c) => c.companyId === companyA.id)).toBe(true);
    expect(fromB.every((c) => c.companyId === companyB.id)).toBe(true);

    // Confirm cross-tenant invisibility
    expect(fromA.find((c) => c.name === 'Beta Co.')).toBeUndefined();
    expect(fromB.find((c) => c.name === 'Acme Co.')).toBeUndefined();
  });
});

describe('Cross-tenant isolation (the Phase 0 acceptance test)', () => {
  it('Company A cannot read Company B’s clients via findUnique', async () => {
    const bClient = await createClient({ companyId: companyB.id }, { name: 'BCo-secret' });

    const leak = await withTenantContext({ companyId: companyA.id }, async (tx) => {
      return tx.client.findUnique({ where: { id: bClient.id } });
    });
    expect(leak).toBeNull();
  });

  it('RLS WITH CHECK rejects a cross-tenant INSERT', async () => {
    // Caller is in Company A's context but tries to write a row with
    // companyId = Company B. The policy's WITH CHECK clause must block this
    // — Prisma surfaces it as a query error.
    await expect(
      withTenantContext({ companyId: companyA.id }, async (tx) => {
        return tx.client.create({
          data: { name: 'cross-tenant-attempt', companyId: companyB.id },
        });
      }),
    ).rejects.toThrow();

    // Confirm no row leaked through.
    const exists = await prisma.client.findFirst({
      where: { name: 'cross-tenant-attempt' },
    });
    expect(exists).toBeNull();
  });
});
