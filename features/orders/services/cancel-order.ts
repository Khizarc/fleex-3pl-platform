import { OrderStatus, StockLevelStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Cancel an order. Permitted from SUBMITTED, AWAITING_STOCK, or
// READY_TO_PICK. If the order had been allocated (READY_TO_PICK), reverse
// every OrderLineAllocation row: decrement RESERVED, increment AVAILABLE,
// delete the allocation. Anything else → IllegalStateTransitionError.
export async function cancelOrder(ctx: TenantContext, orderId: string) {
  return withTenantContext(ctx, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: { include: { allocations: true } } },
    });

    assertTransition(order.status, OrderStatus.CANCELLED);

    if (order.status === OrderStatus.READY_TO_PICK) {
      for (const line of order.lines) {
        for (const alloc of line.allocations) {
          // Decrement RESERVED for this (skuId, binId)
          await tx.stockLevel.update({
            where: {
              skuId_binId_status: {
                skuId: line.skuId,
                binId: alloc.binId,
                status: StockLevelStatus.RESERVED,
              },
            },
            data: { quantity: { decrement: alloc.quantityReserved } },
          });
          // Restore AVAILABLE for this (skuId, binId) — upsert because the
          // AVAILABLE row may have been depleted to 0 (still exists, just at 0)
          // or, theoretically, garbage-collected (not in 1.5).
          await tx.stockLevel.upsert({
            where: {
              skuId_binId_status: {
                skuId: line.skuId,
                binId: alloc.binId,
                status: StockLevelStatus.AVAILABLE,
              },
            },
            create: {
              skuId: line.skuId,
              binId: alloc.binId,
              status: StockLevelStatus.AVAILABLE,
              quantity: alloc.quantityReserved,
              clientId: line.clientId,
              companyId: line.companyId,
            },
            update: { quantity: { increment: alloc.quantityReserved } },
          });
        }
      }
      // Wipe the allocation rows for this order.
      await tx.orderLineAllocation.deleteMany({
        where: { orderLineItemId: { in: order.lines.map((l) => l.id) } },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      include: { lines: { include: { allocations: true } } },
    });
  });
}
