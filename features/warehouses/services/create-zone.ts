import type { Zone } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateZoneInput } from '../validation';

export async function createZone(ctx: TenantContext, input: CreateZoneInput): Promise<Zone> {
  return withTenantContext(ctx, async (tx) => {
    // RLS-filtered lookup: throws if the warehouse doesn't exist OR belongs
    // to another tenant. `companyId` is then derived from the verified parent.
    const parent = await tx.warehouse.findUniqueOrThrow({
      where: { id: input.warehouseId },
      select: { id: true, companyId: true },
    });
    return tx.zone.create({
      data: {
        name: input.name,
        warehouseId: parent.id,
        companyId: parent.companyId,
      },
    });
  });
}
