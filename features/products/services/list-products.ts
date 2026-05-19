import type { Product } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Returned shape includes SKU count so the list row can surface it without
// per-row fetches.
export type ProductListItem = Product & { _count: { skus: number } };

// RLS handles "what can you see":
//   - staff context (no clientId): every product across all clients of the company
//   - portal context (clientId set): only the own-client's products
//
// `options.clientId` is an additional staff-side filter to scope to one client
// without leaving the broader tenant context. RLS still applies on top.
export async function listProducts(
  ctx: TenantContext,
  options: { clientId?: string } = {},
): Promise<ProductListItem[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.product.findMany({
      where: options.clientId ? { clientId: options.clientId } : {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { skus: true } } },
    });
  });
}
