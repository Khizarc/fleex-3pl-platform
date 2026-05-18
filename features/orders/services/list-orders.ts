import type { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Returns one row per order with summary stats. RLS filters: staff context
// sees all clients in the company; portal context sees own client only.
export type OrderListRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  submittedAt: Date;
  allocatedAt: Date | null;
  cancelledAt: Date | null;
  clientId: string;
  clientName: string;
  lineCount: number;
  totalQuantity: number;
  shipToCity: string;
  shipToRegion: string;
};

export async function listOrders(ctx: TenantContext): Promise<OrderListRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const orders = await tx.order.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        lines: { select: { quantity: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      status: o.status,
      submittedAt: o.submittedAt,
      allocatedAt: o.allocatedAt,
      cancelledAt: o.cancelledAt,
      clientId: o.client.id,
      clientName: o.client.name,
      lineCount: o.lines.length,
      totalQuantity: o.lines.reduce((acc, l) => acc + l.quantity, 0),
      shipToCity: o.shipToCity,
      shipToRegion: o.shipToRegion,
    }));
  });
}
