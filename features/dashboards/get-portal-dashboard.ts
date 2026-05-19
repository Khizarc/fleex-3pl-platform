import type { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type PortalDashboard = {
  kpis: {
    inFlightOrders: number;
    totalSkus: number;
    pendingInbounds: number;
    awaitingStock: number;
  };
  recentOrders: Array<{
    id: string;
    status: OrderStatus;
    submittedAt: Date;
    lineCount: number;
  }>;
};

const IN_FLIGHT: OrderStatus[] = [
  'SUBMITTED',
  'AWAITING_STOCK',
  'READY_TO_PICK',
  'PICKING',
  'PICKED',
  'PACKING',
  'PACKED',
  'READY_TO_SHIP',
];

// Portal dashboard aggregate. RLS scopes everything to the calling client.
export async function getPortalDashboard(ctx: TenantContext): Promise<PortalDashboard> {
  return withTenantContext(ctx, async (tx) => {
    const [inFlightOrders, totalSkus, pendingInbounds, awaitingStock, recent] = await Promise.all([
      tx.order.count({ where: { status: { in: IN_FLIGHT } } }),
      tx.sKU.count(),
      tx.inboundShipment.count({ where: { status: { in: ['NOTIFIED', 'RECEIVING'] } } }),
      tx.order.count({ where: { status: 'AWAITING_STOCK' } }),
      tx.order.findMany({
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          _count: { select: { lines: true } },
        },
      }),
    ]);

    return {
      kpis: {
        inFlightOrders,
        totalSkus,
        pendingInbounds,
        awaitingStock,
      },
      recentOrders: recent.map((r) => ({
        id: r.id,
        status: r.status,
        submittedAt: r.submittedAt,
        lineCount: r._count.lines,
      })),
    };
  });
}
