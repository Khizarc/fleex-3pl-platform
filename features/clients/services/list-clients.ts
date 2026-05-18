// Single responsibility: list the clients visible under the current tenant
// context. RLS policies enforce the visibility — this service just queries.

import type { Client } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export async function listClients(ctx: TenantContext): Promise<Client[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.client.findMany({ orderBy: { createdAt: 'desc' } });
  });
}
