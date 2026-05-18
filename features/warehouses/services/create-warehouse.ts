import type { Warehouse } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateWarehouseInput } from '../validation';

export async function createWarehouse(
  ctx: TenantContext,
  input: CreateWarehouseInput,
): Promise<Warehouse> {
  return withTenantContext(ctx, async (tx) => {
    return tx.warehouse.create({
      data: {
        name: input.name,
        address: input.address,
        companyId: ctx.companyId,
      },
    });
  });
}
