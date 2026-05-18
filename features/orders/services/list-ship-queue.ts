import { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Staff ship queue: PACKED orders, oldest first. Everything in this queue
// has all allocations picked (1.8) and box dims + weight captured (1.9).
// Returns slim summary rows for the queue UI.
export type ShipQueueRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  clientId: string;
  clientName: string;
  submittedAt: Date;
  packedAt: Date | null;
  lineCount: number;
  totalQuantity: number;
  shipToCity: string;
  shipToRegion: string;
};

export async function listShipQueue(ctx: TenantContext): Promise<ShipQueueRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const orders = await tx.order.findMany({
      where: { status: OrderStatus.PACKED },
      orderBy: { submittedAt: 'asc' },
      include: {
        client: { select: { id: true, name: true } },
        lines: { select: { quantity: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      status: o.status,
      clientId: o.client.id,
      clientName: o.client.name,
      submittedAt: o.submittedAt,
      packedAt: o.packedAt,
      lineCount: o.lines.length,
      totalQuantity: o.lines.reduce((acc, l) => acc + l.quantity, 0),
      shipToCity: o.shipToCity,
      shipToRegion: o.shipToRegion,
    }));
  });
}
