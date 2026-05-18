import { OrderStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';
import { runAllocation } from './allocate-lines';

// Retry allocation on an order that's currently SUBMITTED or AWAITING_STOCK.
// On success → READY_TO_PICK + allocatedAt. On shortage → AWAITING_STOCK
// (idempotent if already there). Any other current status → illegal.
export async function allocateOrder(ctx: TenantContext, orderId: string) {
  return withTenantContext(ctx, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (order.status !== OrderStatus.SUBMITTED && order.status !== OrderStatus.AWAITING_STOCK) {
      // Will throw IllegalStateTransitionError — captures the rule that
      // allocate only runs from SUBMITTED or AWAITING_STOCK.
      assertTransition(order.status, OrderStatus.READY_TO_PICK);
    }

    const result = await runAllocation(tx, order.id);

    if (result.ok) {
      assertTransition(order.status, OrderStatus.READY_TO_PICK);
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.READY_TO_PICK,
          allocatedAt: new Date(),
        },
        include: { lines: { include: { allocations: true } } },
      });
    }

    // Shortage. If already AWAITING_STOCK, this is a no-op transition — only
    // assert when actually moving status.
    if (order.status !== OrderStatus.AWAITING_STOCK) {
      assertTransition(order.status, OrderStatus.AWAITING_STOCK);
      return tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.AWAITING_STOCK },
        include: { lines: { include: { allocations: true } } },
      });
    }
    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { lines: { include: { allocations: true } } },
    });
  });
}
