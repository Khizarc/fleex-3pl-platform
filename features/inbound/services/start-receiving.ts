import { InboundShipmentStatus, type InboundShipment } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Staff action: NOTIFIED → RECEIVING. Transitions the shipment from "client
// said it's coming" to "we've started checking it in."
export async function startReceiving(
  ctx: TenantContext,
  shipmentId: string,
): Promise<InboundShipment> {
  return withTenantContext(ctx, async (tx) => {
    const shipment = await tx.inboundShipment.findUniqueOrThrow({
      where: { id: shipmentId },
      select: { id: true, status: true },
    });
    assertTransition(shipment.status, InboundShipmentStatus.RECEIVING);
    return tx.inboundShipment.update({
      where: { id: shipment.id },
      data: { status: InboundShipmentStatus.RECEIVING },
    });
  });
}
