import { InboundShipmentStatus, StockLevelStatus, type InboundShipmentLine } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { ReceiveLineInput } from '../validation';

// Staff action: records what was actually received for one line + assigns
// it to a bin. Inside the same transaction, materializes the StockLevel:
// `(skuId, binId, status=AVAILABLE)` row is upsert'd by quantity.
//
// Pre-conditions:
//   - The shipment must be in RECEIVING state (started via `startReceiving`).
//   - The bin must belong to the same company AND the same warehouse as the
//     shipment (so stock doesn't sneak into a bin in another warehouse).
//   - The receiving staff user is recorded on the line.
//
// If `damaged` is true, the StockLevel row uses status=DAMAGED instead of
// AVAILABLE — those goods aren't pickable until inspection clears them.
export async function receiveLine(
  ctx: TenantContext,
  args: ReceiveLineInput & { receivedByUserId: string },
): Promise<InboundShipmentLine> {
  return withTenantContext(ctx, async (tx) => {
    const line = await tx.inboundShipmentLine.findUniqueOrThrow({
      where: { id: args.lineId },
      include: {
        inboundShipment: { select: { status: true, warehouseId: true } },
      },
    });

    if (line.inboundShipment.status !== InboundShipmentStatus.RECEIVING) {
      throw new Error(
        `Can only receive lines on a shipment that is RECEIVING (was ${line.inboundShipment.status}).`,
      );
    }

    // Verify the bin is inside the destination warehouse (RLS already
    // restricted us to our own tenant; this enforces warehouse correctness).
    const bin = await tx.bin.findUniqueOrThrow({
      where: { id: args.binId },
      include: { aisle: { select: { zone: { select: { warehouseId: true } } } } },
    });
    if (bin.aisle.zone.warehouseId !== line.inboundShipment.warehouseId) {
      throw new Error('Bin must be in the shipment’s destination warehouse.');
    }

    const targetStatus = args.damaged ? StockLevelStatus.DAMAGED : StockLevelStatus.AVAILABLE;

    // Upsert the StockLevel row keyed on (skuId, binId, status). Concurrent
    // receives onto the same (sku, bin, status) row resolve via Postgres row
    // locking inside the transaction.
    await tx.stockLevel.upsert({
      where: {
        skuId_binId_status: {
          skuId: line.skuId,
          binId: bin.id,
          status: targetStatus,
        },
      },
      create: {
        skuId: line.skuId,
        binId: bin.id,
        status: targetStatus,
        quantity: args.actualQuantity,
        clientId: line.clientId,
        companyId: line.companyId,
      },
      update: {
        quantity: { increment: args.actualQuantity },
      },
    });

    return tx.inboundShipmentLine.update({
      where: { id: line.id },
      data: {
        actualQuantity: args.actualQuantity,
        binId: bin.id,
        receivedAt: new Date(),
        receivedByUserId: args.receivedByUserId,
        notes: args.notes,
      },
    });
  });
}
