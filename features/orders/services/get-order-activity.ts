import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type OrderActivityEvent = {
  id: string;
  kind: 'submitted' | 'allocated' | 'picked' | 'packed' | 'shipped' | 'cancelled';
  at: Date;
  by: string | null;
  detail?: string;
};

// Derives the activity feed from existing timestamp + audit columns. No new
// schema — just synthesizes events from `submittedAt`, `allocatedAt`,
// per-allocation `pickedAt` / `pickedBy`, `packedAt` / `packedByUser`,
// `shippedAt` / `shippedByUser`, and `cancelledAt`. Sorted oldest-first.
export async function getOrderActivity(
  ctx: TenantContext,
  orderId: string,
): Promise<OrderActivityEvent[]> {
  return withTenantContext(ctx, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        submittedAt: true,
        allocatedAt: true,
        cancelledAt: true,
        packedAt: true,
        shippedAt: true,
        carrier: true,
        trackingNumber: true,
        createdByUser: { select: { name: true } },
        createdByClient: { select: { name: true } },
        packedByUser: { select: { name: true } },
        shippedByUser: { select: { name: true } },
        lines: {
          select: {
            allocations: {
              where: { pickedAt: { not: null } },
              select: {
                id: true,
                pickedAt: true,
                quantityReserved: true,
                bin: { select: { label: true } },
                pickedBy: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!order) return [];

    const events: OrderActivityEvent[] = [];

    if (order.submittedAt) {
      events.push({
        id: 'submitted',
        kind: 'submitted',
        at: order.submittedAt,
        by: order.createdByUser?.name ?? order.createdByClient?.name ?? null,
      });
    }
    if (order.allocatedAt) {
      events.push({ id: 'allocated', kind: 'allocated', at: order.allocatedAt, by: null });
    }
    for (const line of order.lines) {
      for (const alloc of line.allocations) {
        if (alloc.pickedAt) {
          events.push({
            id: `picked-${alloc.id}`,
            kind: 'picked',
            at: alloc.pickedAt,
            by: alloc.pickedBy?.name ?? null,
            detail: `${alloc.quantityReserved} from ${alloc.bin.label}`,
          });
        }
      }
    }
    if (order.packedAt) {
      events.push({
        id: 'packed',
        kind: 'packed',
        at: order.packedAt,
        by: order.packedByUser?.name ?? null,
      });
    }
    if (order.shippedAt) {
      events.push({
        id: 'shipped',
        kind: 'shipped',
        at: order.shippedAt,
        by: order.shippedByUser?.name ?? null,
        detail: order.trackingNumber
          ? `${order.carrier ?? ''} · ${order.trackingNumber}`.trim()
          : undefined,
      });
    }
    if (order.cancelledAt) {
      events.push({ id: 'cancelled', kind: 'cancelled', at: order.cancelledAt, by: null });
    }

    return events.sort((a, b) => a.at.getTime() - b.at.getTime());
  });
}
