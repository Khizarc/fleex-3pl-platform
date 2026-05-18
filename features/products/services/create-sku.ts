import type { SKU } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateSkuInput } from '../validation';

// Same parent-derivation pattern as 1.1's child-creation services: read the
// parent product inside the transaction (RLS hides cross-tenant parents),
// then derive clientId + companyId from it.
export async function createSku(
  ctx: TenantContext,
  args: CreateSkuInput & { productId: string },
): Promise<SKU> {
  return withTenantContext(ctx, async (tx) => {
    const parent = await tx.product.findUniqueOrThrow({
      where: { id: args.productId },
      select: { id: true, clientId: true, companyId: true },
    });
    return tx.sKU.create({
      data: {
        code: args.code,
        name: args.name,
        productId: parent.id,
        clientId: parent.clientId,
        companyId: parent.companyId,
      },
    });
  });
}
