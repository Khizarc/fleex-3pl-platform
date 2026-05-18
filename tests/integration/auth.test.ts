// Auth-helper integration tests. Mocks Clerk (`auth`, `currentUser`) and
// exercises the DB-side branches end-to-end against the real Postgres.
//
// Covers: unauth redirect, role-correct lookup, role-mismatch redirect,
// auto-provision (idempotent + race-safe), unprovisioned client gate.

import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentStaffContext, getCurrentClientContext } from '@/lib/auth';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    // Mimic Next.js: redirect() throws so callers can rely on non-return.
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

const mockedAuth = vi.mocked(auth);
const mockedCurrentUser = vi.mocked(currentUser);

// Helpers to set up Clerk's mocked return shapes.
function mockSignedIn(clerkUserId: string) {
  mockedAuth.mockResolvedValue({ userId: clerkUserId } as never);
}
function mockSignedOut() {
  mockedAuth.mockResolvedValue({ userId: null } as never);
}
function mockClerkUser(email: string, firstName = 'Test', lastName = 'User') {
  mockedCurrentUser.mockResolvedValue({
    emailAddresses: [{ emailAddress: email }],
    firstName,
    lastName,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('getCurrentStaffContext', () => {
  it('redirects unauthenticated requests to /sign-in', async () => {
    mockSignedOut();
    await expect(getCurrentStaffContext()).rejects.toThrow(/NEXT_REDIRECT: \/sign-in/);
  });

  it('returns staff context for a signed-in staff user', async () => {
    const company = await prisma.company.create({ data: { name: 'Acme 3PL' } });
    const user = await prisma.user.create({
      data: {
        authProviderId: 'clerk_staff_1',
        email: 'staff@acme.test',
        name: 'Staff One',
        role: Role.ADMIN,
        companyId: company.id,
      },
    });
    mockSignedIn('clerk_staff_1');

    const ctx = await getCurrentStaffContext();
    expect(ctx.user.id).toBe(user.id);
    expect(ctx.company.id).toBe(company.id);
    expect(ctx.tenant).toEqual({ companyId: company.id });
  });

  it('redirects a ClientUser to /portal when they hit /warehouse', async () => {
    const company = await prisma.company.create({ data: { name: 'Wrongshell 3PL' } });
    const client = await prisma.client.create({
      data: { name: 'Wrongshell Client', companyId: company.id },
    });
    await prisma.clientUser.create({
      data: {
        authProviderId: 'clerk_client_only_1',
        email: 'client@wrongshell.test',
        name: 'Wrong Shell',
        companyId: company.id,
        clientId: client.id,
      },
    });
    mockSignedIn('clerk_client_only_1');

    await expect(getCurrentStaffContext()).rejects.toThrow(/NEXT_REDIRECT: \/portal/);
  });

  it('auto-provisions a brand-new sign-up as a Company admin', async () => {
    mockSignedIn('clerk_newcomer_1');
    mockClerkUser('newcomer@solo.test', 'New', 'Comer');

    const ctx = await getCurrentStaffContext();
    expect(ctx.user.role).toBe(Role.ADMIN);
    expect(ctx.user.email).toBe('newcomer@solo.test');
    expect(ctx.user.name).toBe('New Comer');
    expect(ctx.company.name).toBe("newcomer's Workspace");
    expect(ctx.tenant).toEqual({ companyId: ctx.company.id });

    // Idempotent: second call returns the same User + Company (no duplicates).
    const ctx2 = await getCurrentStaffContext();
    expect(ctx2.user.id).toBe(ctx.user.id);
    expect(ctx2.company.id).toBe(ctx.company.id);
  });

  it('auto-provision is race-safe under concurrent calls', async () => {
    mockSignedIn('clerk_racer_1');
    mockClerkUser('racer@solo.test');

    const [a, b, c] = await Promise.all([
      getCurrentStaffContext(),
      getCurrentStaffContext(),
      getCurrentStaffContext(),
    ]);
    expect(a.user.id).toBe(b.user.id);
    expect(b.user.id).toBe(c.user.id);

    // Only ONE User row exists for this Clerk ID.
    const users = await prisma.user.findMany({
      where: { authProviderId: 'clerk_racer_1' },
    });
    expect(users.length).toBe(1);

    // Only ONE Company was created for this newcomer.
    const companies = await prisma.company.findMany({
      where: { name: "racer's Workspace" },
    });
    expect(companies.length).toBe(1);
  });
});

describe('getCurrentClientContext', () => {
  it('redirects unauthenticated requests to /sign-in', async () => {
    mockSignedOut();
    await expect(getCurrentClientContext()).rejects.toThrow(/NEXT_REDIRECT: \/sign-in/);
  });

  it('returns client context for a signed-in ClientUser', async () => {
    const company = await prisma.company.create({ data: { name: 'PortalCo 3PL' } });
    const client = await prisma.client.create({
      data: { name: 'PortalCo Client', companyId: company.id },
    });
    const clientUser = await prisma.clientUser.create({
      data: {
        authProviderId: 'clerk_clientuser_1',
        email: 'pu@portalco.test',
        name: 'Portal User',
        companyId: company.id,
        clientId: client.id,
      },
    });
    mockSignedIn('clerk_clientuser_1');

    const ctx = await getCurrentClientContext();
    expect(ctx.clientUser.id).toBe(clientUser.id);
    expect(ctx.client.id).toBe(client.id);
    expect(ctx.company.id).toBe(company.id);
    expect(ctx.tenant).toEqual({ companyId: company.id, clientId: client.id });
  });

  it('redirects a staff User to /warehouse when they hit /portal', async () => {
    const company = await prisma.company.create({ data: { name: 'Staff-only 3PL' } });
    await prisma.user.create({
      data: {
        authProviderId: 'clerk_staff_wrong_shell_1',
        email: 's@staff.test',
        name: 'Staff Wrong',
        role: Role.ADMIN,
        companyId: company.id,
      },
    });
    mockSignedIn('clerk_staff_wrong_shell_1');

    await expect(getCurrentClientContext()).rejects.toThrow(/NEXT_REDIRECT: \/warehouse/);
  });

  it('redirects an unprovisioned signed-in user to /access-pending', async () => {
    mockSignedIn('clerk_unprovisioned_1');

    await expect(getCurrentClientContext()).rejects.toThrow(/NEXT_REDIRECT: \/access-pending/);
  });
});
