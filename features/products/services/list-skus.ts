import type { SKU } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export async function listSkus(ctx: TenantContext, args: { productId: string }): Promise<SKU[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.sKU.findMany({
      where: { productId: args.productId },
      orderBy: { code: 'asc' },
    });
  });
}
