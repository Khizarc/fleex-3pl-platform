import type { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type StaffDashboard = {
  kpis: {
    activeOrders: number;
    pendingReceive: number;
    readyToPick: number;
    readyToShip: number;
  };
  needsAttention: Array<{
    id: string;
    clientName: string;
    status: OrderStatus;
    submittedAt: Date;
  }>;
  todayActivity: {
    picked: number;
    packed: number;
    shipped: number;
  };
};

const ACTIVE_STATUSES: OrderStatus[] = [
  'SUBMITTED',
  'AWAITING_STOCK',
  'READY_TO_PICK',
  'PICKING',
  'PICKED',
  'PACKING',
  'PACKED',
  'READY_TO_SHIP',
];

// Single round-trip aggregate for the staff dashboard. All queries share one
// transaction so RLS scopes them to the calling company.
export async function getStaffDashboard(ctx: TenantContext): Promise<StaffDashboard> {
  return withTenantContext(ctx, async (tx) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activeOrders,
      pendingReceive,
      readyToPick,
      readyToShip,
      attentionRows,
      pickedToday,
      packedToday,
      shippedToday,
    ] = await Promise.all([
      tx.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      tx.inboundShipment.count({
        where: { status: { in: ['NOTIFIED', 'RECEIVING'] } },
      }),
      tx.order.count({ where: { status: 'READY_TO_PICK' } }),
      tx.order.count({ where: { status: { in: ['PACKED', 'READY_TO_SHIP'] } } }),
      tx.order.findMany({
        where: { status: { in: ['AWAITING_STOCK', 'ON_HOLD', 'EXCEPTION'] } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          client: { select: { name: true } },
        },
        orderBy: { submittedAt: 'asc' },
        take: 5,
      }),
      tx.orderLineAllocation.count({ where: { pickedAt: { gte: startOfDay } } }),
      tx.order.count({ where: { packedAt: { gte: startOfDay } } }),
      tx.order.count({ where: { shippedAt: { gte: startOfDay } } }),
    ]);

    return {
      kpis: {
        activeOrders,
        pendingReceive,
        readyToPick,
        readyToShip,
      },
      needsAttention: attentionRows.map((r) => ({
        id: r.id,
        clientName: r.client.name,
        status: r.status,
        submittedAt: r.submittedAt,
      })),
      todayActivity: {
        picked: pickedToday,
        packed: packedToday,
        shipped: shippedToday,
      },
    };
  });
}
