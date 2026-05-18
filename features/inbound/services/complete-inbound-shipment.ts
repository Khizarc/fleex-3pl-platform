import { InboundShipmentStatus, type InboundShipment } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Staff action: marks the shipment complete. Auto-detects whether actual
// quantities matched expected on every line — sets COMPLETED if yes,
// COMPLETED_WITH_DISCREPANCIES otherwise.
export async function completeInboundShipment(
  ctx: TenantContext,
  shipmentId: string,
): Promise<InboundShipment> {
  return withTenantContext(ctx, async (tx) => {
    const shipment = await tx.inboundShipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        lines: {
          select: { id: true, expectedQuantity: true, actualQuantity: true, receivedAt: true },
        },
      },
    });

    // Every line must have been received.
    const unreceived = shipment.lines.filter((l) => l.receivedAt === null);
    if (unreceived.length > 0) {
      throw new Error(`Cannot complete — ${unreceived.length} line(s) have not been received yet.`);
    }

    const hasDiscrepancy = shipment.lines.some((l) => l.actualQuantity !== l.expectedQuantity);
    const next = hasDiscrepancy
      ? InboundShipmentStatus.COMPLETED_WITH_DISCREPANCIES
      : InboundShipmentStatus.COMPLETED;

    assertTransition(shipment.status, next);

    return tx.inboundShipment.update({
      where: { id: shipment.id },
      data: { status: next },
    });
  });
}
