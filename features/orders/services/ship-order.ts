import { Carrier, OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Mark a PACKED order as SHIPPED with carrier + tracking number + optional
// notes. Concurrency model mirrors 1.9 `packOrder`:
//   - `SELECT ... FOR UPDATE` on the Order row serializes concurrent shippers.
//   - The status flip uses `updateMany({ where: { id, status: PACKED } })`
//     so a second shipper who slipped past the lock still sees count=0 and
//     we throw `OrderAlreadyShippedError`.
//
// Server-side cleanup: `carrierOther` is nulled when carrier is one of the
// four known values, so the column is a clean invariant ("non-null iff
// carrier == OTHER"). Don't trust the client to do this.

export class OrderAlreadyShippedError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} is no longer in PACKED status — another shipper may have won.`);
    this.name = 'OrderAlreadyShippedError';
  }
}

export async function shipOrder(
  ctx: TenantContext,
  args: {
    orderId: string;
    carrier: Carrier;
    carrierOther?: string;
    trackingNumber: string;
    shipNotes?: string;
    shippedByUserId: string;
  },
) {
  return withTenantContext(ctx, async (tx) => {
    // RLS-load. Throws if not visible (cross-tenant or unknown).
    const order = await tx.order.findUniqueOrThrow({
      where: { id: args.orderId },
      select: { id: true, status: true },
    });

    // Row-level lock to serialize concurrent shippers.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;

    // Re-read status under the lock.
    const locked = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    if (locked.status !== OrderStatus.PACKED) {
      // Will throw IllegalStateTransitionError — captures the rule that
      // ship only runs from PACKED.
      assertTransition(locked.status, OrderStatus.SHIPPED);
    }

    assertTransition(OrderStatus.PACKED, OrderStatus.SHIPPED);

    // Server-side cleanup of carrierOther: non-null iff carrier == OTHER.
    const carrierOther =
      args.carrier === Carrier.OTHER ? (args.carrierOther?.trim() ?? null) : null;

    const now = new Date();
    const result = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PACKED },
      data: {
        status: OrderStatus.SHIPPED,
        shippedAt: now,
        shippedByUserId: args.shippedByUserId,
        carrier: args.carrier,
        carrierOther,
        trackingNumber: args.trackingNumber.trim(),
        shipNotes: args.shipNotes,
      },
    });
    if (result.count === 0) {
      throw new OrderAlreadyShippedError(order.id);
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        client: { select: { id: true, name: true } },
        shippedByUser: { select: { id: true, name: true } },
      },
    });
  });
}
