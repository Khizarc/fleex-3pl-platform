import type { Aisle } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateAisleInput } from '../validation';

export async function createAisle(ctx: TenantContext, input: CreateAisleInput): Promise<Aisle> {
  return withTenantContext(ctx, async (tx) => {
    const parent = await tx.zone.findUniqueOrThrow({
      where: { id: input.zoneId },
      select: { id: true, companyId: true },
    });
    return tx.aisle.create({
      data: {
        name: input.name,
        zoneId: parent.id,
        companyId: parent.companyId,
      },
    });
  });
}
