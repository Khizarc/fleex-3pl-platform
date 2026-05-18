import type { AccountStatus, Role } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Per-staff productivity rollup for the Team page.
//
// Implementation: 4 parallel groupBy queries keyed on the userId column on
// each work table + JS merge. Prisma `_count` on filtered relations across
// 4 tables doesn't compose cleanly; groupBy is the simpler shape and is
// fast at expected scale (<100 staff per company).

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  authProviderId: string | null;
  createdAt: Date;
  inboundLinesReceived: number;
  picksCompleted: number;
  ordersPacked: number;
  ordersShipped: number;
  lastActivityAt: Date | null;
};

export async function listStaff(ctx: TenantContext): Promise<StaffRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const users = await tx.user.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        authProviderId: true,
        createdAt: true,
      },
    });
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);

    // 4 parallel groupBy queries. Each returns rows of
    // { userId, _count: { _all: N }, _max: { timestampCol: Date } }
    const [inbound, picks, packs, ships] = await Promise.all([
      tx.inboundShipmentLine.groupBy({
        by: ['receivedByUserId'],
        where: { receivedByUserId: { in: userIds } },
        _count: { _all: true },
        _max: { receivedAt: true },
      }),
      tx.orderLineAllocation.groupBy({
        by: ['pickedByUserId'],
        where: { pickedByUserId: { in: userIds } },
        _count: { _all: true },
        _max: { pickedAt: true },
      }),
      tx.order.groupBy({
        by: ['packedByUserId'],
        where: { packedByUserId: { in: userIds } },
        _count: { _all: true },
        _max: { packedAt: true },
      }),
      tx.order.groupBy({
        by: ['shippedByUserId'],
        where: { shippedByUserId: { in: userIds } },
        _count: { _all: true },
        _max: { shippedAt: true },
      }),
    ]);

    const inboundMap = new Map(
      inbound
        .filter((r) => r.receivedByUserId !== null)
        .map((r) => [r.receivedByUserId!, { count: r._count._all, at: r._max.receivedAt }]),
    );
    const picksMap = new Map(
      picks
        .filter((r) => r.pickedByUserId !== null)
        .map((r) => [r.pickedByUserId!, { count: r._count._all, at: r._max.pickedAt }]),
    );
    const packsMap = new Map(
      packs
        .filter((r) => r.packedByUserId !== null)
        .map((r) => [r.packedByUserId!, { count: r._count._all, at: r._max.packedAt }]),
    );
    const shipsMap = new Map(
      ships
        .filter((r) => r.shippedByUserId !== null)
        .map((r) => [r.shippedByUserId!, { count: r._count._all, at: r._max.shippedAt }]),
    );

    return users.map((u) => {
      const i = inboundMap.get(u.id);
      const p = picksMap.get(u.id);
      const k = packsMap.get(u.id);
      const s = shipsMap.get(u.id);
      const times = [i?.at, p?.at, k?.at, s?.at].filter((d): d is Date => d instanceof Date);
      const lastActivityAt =
        times.length > 0 ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        authProviderId: u.authProviderId,
        createdAt: u.createdAt,
        inboundLinesReceived: i?.count ?? 0,
        picksCompleted: p?.count ?? 0,
        ordersPacked: k?.count ?? 0,
        ordersShipped: s?.count ?? 0,
        lastActivityAt,
      };
    });
  });
}
