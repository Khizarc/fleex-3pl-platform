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
//   - unauthenticated                    → /sign-in
//   - is a ClientUser by authProviderId  → /portal (wrong shell)
//   - has an unclaimed ClientUser invite → /portal (let portal helper claim it)
//   - brand-new sign-up, no invite       → auto-provision new Company + admin User
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

  // If an admin has invited this email as a ClientUser (Milestone 0.5),
  // send them to /portal — claiming happens there.
  const inviteEmail = await getSessionEmail();
  if (inviteEmail) {
    const invited = await findUnclaimedInviteByEmail(inviteEmail);
    if (invited) redirect('/portal');
  }

  return autoProvisionStaff(session.userId, inviteEmail);
});

// Client portal entry point. Redirects:
//   - unauthenticated                    → /sign-in
//   - has matching ClientUser            → return client context
//   - has unclaimed ClientUser by email  → claim it, return client context
//   - is a staff User instead            → /warehouse (wrong shell)
//   - none of the above                  → /access-pending
export const getCurrentClientContext = cache(async (): Promise<ClientPortalContext> => {
  const session = await auth();
  if (!session.userId) redirect('/sign-in');

  const claimed = await prisma.clientUser.findUnique({
    where: { authProviderId: session.userId },
    include: { client: { include: { company: true } } },
  });
  if (claimed) return toClientContext(claimed);

  // Claim-by-email: a pre-created ClientUser with authProviderId = NULL whose
  // email matches this Clerk user's email. See docs/ARCHITECTURE.md decision
  // log for 0.5.
  const email = await getSessionEmail();
  if (email) {
    const justClaimed = await claimInviteForUser(session.userId, email);
    if (justClaimed) {
      const full = await prisma.clientUser.findUnique({
        where: { id: justClaimed.id },
        include: { client: { include: { company: true } } },
      });
      if (full) return toClientContext(full);
    }
  }

  const asStaff = await prisma.user.findUnique({
    where: { authProviderId: session.userId },
  });
  if (asStaff) redirect('/warehouse');

  redirect('/access-pending');
});

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

type ClientUserWithRelations = ClientUser & { client: Client & { company: Company } };

function toClientContext(row: ClientUserWithRelations): ClientPortalContext {
  return {
    clientUser: row,
    client: row.client,
    company: row.client.company,
    tenant: { companyId: row.companyId, clientId: row.clientId },
  };
}

async function getSessionEmail(): Promise<string | undefined> {
  const clerk = await currentUser();
  return clerk?.emailAddresses[0]?.emailAddress;
}

function findUnclaimedInviteByEmail(email: string) {
  // Oldest unclaimed match wins — deterministic if an admin pre-created
  // multiple invites with the same email across different clients.
  return prisma.clientUser.findFirst({
    where: { email, authProviderId: null },
    orderBy: { createdAt: 'asc' },
  });
}

// Race-safe claim: `updateMany` filters on `authProviderId IS NULL` so a
// concurrent claim on the same candidate returns count=0. We re-read by the
// new owner's authProviderId to surface whichever row was already linked.
async function claimInviteForUser(clerkUserId: string, email: string): Promise<ClientUser | null> {
  const candidate = await findUnclaimedInviteByEmail(email);
  if (!candidate) return null;

  const result = await prisma.clientUser.updateMany({
    where: { id: candidate.id, authProviderId: null },
    data: { authProviderId: clerkUserId },
  });
  if (result.count === 1) {
    return prisma.clientUser.findUnique({ where: { id: candidate.id } });
  }
  return prisma.clientUser.findUnique({ where: { authProviderId: clerkUserId } });
}

// Auto-provision: brand-new signed-up user becomes the admin of their own 3PL.
// Race-safe: the User.authProviderId unique constraint resolves duplicate
// concurrent inserts; we catch P2002 and return whichever row won.
async function autoProvisionStaff(
  clerkUserId: string,
  precomputedEmail?: string,
): Promise<StaffContext> {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  const email =
    precomputedEmail ?? clerk.emailAddresses[0]?.emailAddress ?? `${clerkUserId}@unknown`;
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
