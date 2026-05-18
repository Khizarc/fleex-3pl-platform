import type { Product } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateProductInput } from '../validation';

// `clientId` is passed by the caller (staff path: from URL param; portal path:
// from the resolved client context). RLS verifies the client belongs to this
// tenant; `companyId` is derived from the verified Client row.
export async function createProduct(
  ctx: TenantContext,
  args: CreateProductInput & { clientId: string },
): Promise<Product> {
  return withTenantContext(ctx, async (tx) => {
    const parent = await tx.client.findUniqueOrThrow({
      where: { id: args.clientId },
      select: { id: true, companyId: true },
    });
    return tx.product.create({
      data: {
        name: args.name,
        description: args.description,
        clientId: parent.id,
        companyId: parent.companyId,
      },
    });
  });
}
