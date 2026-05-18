import type { Warehouse } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export async function listWarehouses(ctx: TenantContext): Promise<Warehouse[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.warehouse.findMany({ orderBy: { createdAt: 'desc' } });
  });
}
