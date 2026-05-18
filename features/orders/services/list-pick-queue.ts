import { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Returns the staff pick queue: orders awaiting pick or in-progress, sorted
// oldest first. Each row carries a progress count (pickedAllocations /
// totalAllocations) so the queue UI can render at-a-glance status without
// loading every allocation.
//
// `warehouseId` is accepted for forward-compat with 1.11+ but unused in 1.8
// UI. RLS already scopes by company/client.
export type PickQueueRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  clientId: string;
  clientName: string;
  submittedAt: Date;
  lineCount: number;
  totalQuantity: number;
  totalAllocations: number;
  pickedAllocations: number;
  shipToCity: string;
  shipToRegion: string;
};

export async function listPickQueue(
  ctx: TenantContext,
  _options: { warehouseId?: string } = {},
): Promise<PickQueueRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const orders = await tx.order.findMany({
      where: { status: { in: [OrderStatus.READY_TO_PICK, OrderStatus.PICKING] } },
      orderBy: { submittedAt: 'asc' },
      include: {
        client: { select: { id: true, name: true } },
        lines: {
          select: {
            quantity: true,
            allocations: { select: { id: true, pickedAt: true } },
          },
        },
      },
    });

    return orders.map((o) => {
      const allocations = o.lines.flatMap((l) => l.allocations);
      return {
        id: o.id,
        reference: o.reference,
        status: o.status,
        clientId: o.client.id,
        clientName: o.client.name,
        submittedAt: o.submittedAt,
        lineCount: o.lines.length,
        totalQuantity: o.lines.reduce((acc, l) => acc + l.quantity, 0),
        totalAllocations: allocations.length,
        pickedAllocations: allocations.filter((a) => a.pickedAt !== null).length,
        shipToCity: o.shipToCity,
        shipToRegion: o.shipToRegion,
      };
    });
  });
}
