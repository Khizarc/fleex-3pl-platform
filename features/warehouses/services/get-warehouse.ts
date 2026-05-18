import type { Aisle, Bin, Warehouse, Zone } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type WarehouseWithStructure = Warehouse & {
  zones: (Zone & {
    aisles: (Aisle & { bins: Bin[] })[];
  })[];
};

// RLS filters every level. If the warehouse belongs to a different tenant
// (or doesn't exist), this returns null and the caller renders a 404.
export async function getWarehouse(
  ctx: TenantContext,
  id: string,
): Promise<WarehouseWithStructure | null> {
  return withTenantContext(ctx, async (tx) => {
    return tx.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { name: 'asc' },
          include: {
            aisles: {
              orderBy: { name: 'asc' },
              include: { bins: { orderBy: { label: 'asc' } } },
            },
          },
        },
      },
    });
  });
}
