import type { Bin } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateBinInput } from '../validation';

export async function createBin(ctx: TenantContext, input: CreateBinInput): Promise<Bin> {
  return withTenantContext(ctx, async (tx) => {
    const parent = await tx.aisle.findUniqueOrThrow({
      where: { id: input.aisleId },
      select: { id: true, companyId: true },
    });
    return tx.bin.create({
      data: {
        label: input.label,
        aisleId: parent.id,
        companyId: parent.companyId,
      },
    });
  });
}
