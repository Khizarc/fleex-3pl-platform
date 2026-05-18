import { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import { prisma } from '@/lib/db/prisma';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Mark a PICKED order as PACKED with box dimensions, weight, and an
// optional pack note. Concurrency model mirrors 1.8 `pickAllocation`:
//   - `SELECT ... FOR UPDATE` on the Order row serializes concurrent
//     packers.
//   - The status flip uses `updateMany({ where: { id, status: PICKED } })`
//     so a second packer who slipped past the lock still sees count=0 and
//     we throw `OrderAlreadyPackedError`.
//
// `packedAt` lives on Order in 1.9 (single-shipment assumption). Future
// split-shipment work extracts these columns into an `OrderShipment` table.

export class OrderAlreadyPackedError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} is no longer in PICKED status — another packer may have won.`);
    this.name = 'OrderAlreadyPackedError';
  }
}

export async function packOrder(
  ctx: TenantContext,
  args: {
    orderId: string;
    boxLengthMm: number;
    boxWidthMm: number;
    boxHeightMm: number;
    boxWeightG: number;
    packNotes?: string;
    packedByUserId: string;
  },
) {
  return withTenantContext(ctx, async (tx) => {
    // RLS-load the order. Throws if not visible (cross-tenant or unknown).
    const order = await tx.order.findUniqueOrThrow({
      where: { id: args.orderId },
      select: { id: true, status: true },
    });

    // Row-level lock to serialize concurrent packers on the same order.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;

    // Re-read status under the lock.
    const locked = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    if (locked.status !== OrderStatus.PICKED) {
      // Will throw IllegalStateTransitionError — captures the rule that
      // pack only runs from PICKED.
      assertTransition(locked.status, OrderStatus.PACKED);
    }

    assertTransition(OrderStatus.PICKED, OrderStatus.PACKED);

    // Idempotent flip: another packer who somehow slipped past the lock
    // would see count=0 and we throw.
    const now = new Date();
    const result = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PICKED },
      data: {
        status: OrderStatus.PACKED,
        packedAt: now,
        packedByUserId: args.packedByUserId,
        boxLengthMm: args.boxLengthMm,
        boxWidthMm: args.boxWidthMm,
        boxHeightMm: args.boxHeightMm,
        boxWeightG: args.boxWeightG,
        packNotes: args.packNotes,
      },
    });
    if (result.count === 0) {
      throw new OrderAlreadyPackedError(order.id);
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        client: { select: { id: true, name: true } },
        packedByUser: { select: { id: true, name: true } },
      },
    });
  });
}

// Re-export prisma so tests can clean up if needed.
export { prisma };
