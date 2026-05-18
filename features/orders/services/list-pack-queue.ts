import { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Staff pack queue: orders in PICKED status, oldest first. The pick screen
// (1.8) is upstream; everything in this queue has all allocations stamped
// with `pickedAt`. Returns slim summary rows for the queue UI.
export type PackQueueRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  clientId: string;
  clientName: string;
  submittedAt: Date;
  lineCount: number;
  totalQuantity: number;
  shipToCity: string;
  shipToRegion: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export async function listPackQueue(ctx: TenantContext): Promise<PackQueueRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const orders = await tx.order.findMany({
      where: { status: OrderStatus.PICKED },
      orderBy: { submittedAt: 'asc' },
      include: {
        client: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
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
      lineCount: o.lines.length,
      totalQuantity: o.lines.reduce((acc, l) => acc + l.quantity, 0),
      shipToCity: o.shipToCity,
      shipToRegion: o.shipToRegion,
      assigneeId: o.assignedToUser?.id ?? null,
      assigneeName: o.assignedToUser?.name ?? null,
    }));
  });
}
