// Single responsibility: create one Client within a tenant context, optionally
// with a first ClientUser. Runs inside `withTenantContext`, so RLS `WITH CHECK`
// rejects any attempt to write rows for the wrong company.

import type { Client } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateClientInput } from '../validation';

export async function createClient(ctx: TenantContext, input: CreateClientInput): Promise<Client> {
  return withTenantContext(ctx, async (tx) => {
    const client = await tx.client.create({
      data: {
        name: input.name,
        companyId: ctx.companyId,
      },
    });

    // The schema allows empty strings (HTML inputs default to ''); treat them
    // as "no invite." Both must be present and non-empty to provision a row.
    const email = input.firstUserEmail?.trim();
    const name = input.firstUserName?.trim();
    if (email && name) {
      // authProviderId stays NULL until the invitee signs up — see the
      // claim-by-email flow in lib/auth/current-user.ts.
      await tx.clientUser.create({
        data: {
          authProviderId: null,
          email,
          name,
          companyId: ctx.companyId,
          clientId: client.id,
        },
      });
    }

    return client;
  });
}
