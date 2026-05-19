// Single responsibility: list the clients visible under the current tenant
// context. RLS policies enforce the visibility — this service just queries.
// Includes product + portal-user counts so the list row can show them as
// affordances ("3 products, 2 portal users") without an extra fetch per row.

import type { Client } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type ClientListItem = Client & {
  _count: { products: number; clientUsers: number };
};

export async function listClients(ctx: TenantContext): Promise<ClientListItem[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { products: true, clientUsers: true } },
      },
    });
  });
}
