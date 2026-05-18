// Resolve a Clerk session → a DB-backed staff or client context.
//
// These two helpers are the only sanctioned way to discover "who is making
// this request" on the server. They redirect on miss/mismatch instead of
// returning null, so calling code can treat the return value as guaranteed.
//
// The auth lookup uses `prisma` (owner client, bypasses RLS) intentionally —
// at this point we don't yet know which tenant the user belongs to. Every
// query AFTER resolution must go through `withTenantContext`.

import { auth, currentUser } from '@clerk/nextjs/server';
import {
  Prisma,
  Role,
  type Client,
  type ClientUser,
  type Company,
  type User,
} from '@prisma/client';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import type { TenantContext } from '@/lib/tenancy';

export type StaffContext = {
  user: User;
  company: Company;
  tenant: TenantContext;
};

export type ClientPortalContext = {
  clientUser: ClientUser;
  client: Client;
  company: Company;
  tenant: TenantContext;
};

// Staff entry point. Redirects:
//   - unauthenticated         → /sign-in
//   - is a ClientUser instead → /portal (wrong shell)
//   - brand-new sign-up       → auto-provision new Company + admin User
//
// Wrapped in React `cache()` so a route group layout AND its child pages
// share one resolution per request (no duplicate DB hits).
export const getCurrentStaffContext = cache(async (): Promise<StaffContext> => {
  const session = await auth();
  if (!session.userId) redirect('/sign-in');

  const existing = await prisma.user.findUnique({
    where: { authProviderId: session.userId },
    include: { company: true },
  });
  if (existing) {
    return {
      user: existing,
      company: existing.company,
      tenant: { companyId: existing.companyId },
    };
  }

  const asClient = await prisma.clientUser.findUnique({
    where: { authProviderId: session.userId },
  });
  if (asClient) redirect('/portal');

  return autoProvisionStaff(session.userId);
});

// Client portal entry point. Redirects:
//   - unauthenticated    → /sign-in
//   - is a User instead  → /warehouse (wrong shell)
//   - no ClientUser row  → /access-pending (must be invited by 3PL admin in 0.5+)
//
// Same cache() wrapper rationale as `getCurrentStaffContext`.
export const getCurrentClientContext = cache(async (): Promise<ClientPortalContext> => {
  const session = await auth();
  if (!session.userId) redirect('/sign-in');

  const existing = await prisma.clientUser.findUnique({
    where: { authProviderId: session.userId },
    include: { client: { include: { company: true } } },
  });
  if (existing) {
    return {
      clientUser: existing,
      client: existing.client,
      company: existing.client.company,
      tenant: { companyId: existing.companyId, clientId: existing.clientId },
    };
  }

  const asStaff = await prisma.user.findUnique({
    where: { authProviderId: session.userId },
  });
  if (asStaff) redirect('/warehouse');

  redirect('/access-pending');
});

// Auto-provision: brand-new signed-up user becomes the admin of their own 3PL.
// Race-safe: the User.authProviderId unique constraint resolves duplicate
// concurrent inserts; we catch P2002 and return whichever row won.
async function autoProvisionStaff(clerkUserId: string): Promise<StaffContext> {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  const email = clerk.emailAddresses[0]?.emailAddress ?? `${clerkUserId}@unknown`;
  const displayName = [clerk.firstName, clerk.lastName].filter(Boolean).join(' ') || email;
  const workspaceName = `${email.split('@')[0]}'s Workspace`;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: workspaceName } });
      const user = await tx.user.create({
        data: {
          authProviderId: clerkUserId,
          email,
          name: displayName,
          role: Role.ADMIN,
          companyId: company.id,
        },
      });
      return { user, company };
    });
    return {
      user: created.user,
      company: created.company,
      tenant: { companyId: created.company.id },
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Concurrent provisioning won the race — re-read.
      const winner = await prisma.user.findUnique({
        where: { authProviderId: clerkUserId },
        include: { company: true },
      });
      if (winner) {
        return {
          user: winner,
          company: winner.company,
          tenant: { companyId: winner.companyId },
        };
      }
    }
    throw err;
  }
}
