import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Detail view: order + lines + per-bin allocations + SKU info + client name.
// RLS scopes naturally: portal sees own only; staff sees within their company.
export async function getOrder(ctx: TenantContext, orderId: string) {
  return withTenantContext(ctx, async (tx) => {
    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true } },
        lines: {
          include: {
            sku: { select: { id: true, code: true, name: true } },
            allocations: {
              include: { bin: { select: { id: true, label: true } } },
            },
          },
        },
      },
    });
  });
}
