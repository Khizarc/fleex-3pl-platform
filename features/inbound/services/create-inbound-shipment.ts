import type { InboundShipment } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreateInboundShipmentInput } from '../validation';

// Portal action: a client notifies the 3PL of inventory on the way.
// `clientId` comes from the caller (resolved from the portal context).
// The transaction reads the destination warehouse (RLS hides cross-tenant
// warehouses) and validates each SKU belongs to the same client.
export async function createInboundShipment(
  ctx: TenantContext,
  args: CreateInboundShipmentInput & { clientId: string },
): Promise<InboundShipment> {
  return withTenantContext(ctx, async (tx) => {
    // RLS-verified parent reads
    const warehouse = await tx.warehouse.findUniqueOrThrow({
      where: { id: args.warehouseId },
      select: { id: true, companyId: true },
    });

    // Every line's SKU must belong to this client (RLS-filtered).
    const skuIds = args.lines.map((l) => l.skuId);
    const skus = await tx.sKU.findMany({
      where: { id: { in: skuIds }, clientId: args.clientId },
      select: { id: true },
    });
    if (skus.length !== new Set(skuIds).size) {
      throw new Error('One or more SKUs do not belong to this client.');
    }

    // Form sends a YYYY-MM-DD string (or empty / undefined). Coerce here.
    const expectedArrivalAt =
      args.expectedArrivalAt && args.expectedArrivalAt !== ''
        ? new Date(args.expectedArrivalAt)
        : null;

    return tx.inboundShipment.create({
      data: {
        reference: args.reference,
        expectedArrivalAt,
        notes: args.notes,
        clientId: args.clientId,
        companyId: warehouse.companyId,
        warehouseId: warehouse.id,
        lines: {
          create: args.lines.map((l) => ({
            skuId: l.skuId,
            expectedQuantity: l.expectedQuantity,
            clientId: args.clientId,
            companyId: warehouse.companyId,
          })),
        },
      },
    });
  });
}
