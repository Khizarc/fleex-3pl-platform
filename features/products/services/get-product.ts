import type { Product, SKU } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type ProductWithSkus = Product & { skus: SKU[] };

// RLS-filtered. Returns null if the product doesn't exist in this tenant
// (and the caller renders a 404).
export async function getProduct(ctx: TenantContext, id: string): Promise<ProductWithSkus | null> {
  return withTenantContext(ctx, async (tx) => {
    return tx.product.findUnique({
      where: { id },
      include: { skus: { orderBy: { code: 'asc' } } },
    });
  });
}
