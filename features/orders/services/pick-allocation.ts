import { AccountStatus, OrderStatus, Prisma, StockLevelStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';

// Pick one OrderLineAllocation (one bin trip). Atomic across:
//   - bin-label match check
//   - StockLevel RESERVED decrement
//   - allocation `pickedAt` / `pickedByUserId` write
//   - conditional state transitions (READY_TO_PICK → PICKING; PICKING → PICKED)
//
// Concurrency model:
//   - `withTenantContext` opens a tenant-scoped transaction.
//   - We `SELECT ... FOR UPDATE` the Order row at the top. Any concurrent
//     picker on the same order waits here, so the "any allocations left?"
//     count + final status flip are serialized — no double PICKING→PICKED
//     fires, no negative RESERVED.
//   - The allocation write uses `updateMany({ where: { id, pickedAt: null } })`
//     so a second pick on the same allocation returns count=0 and we throw.
export class BinLabelMismatchError extends Error {
  readonly expected: string;
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super(`Bin label mismatch: expected "${expected}", got "${actual}".`);
    this.name = 'BinLabelMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class AllocationAlreadyPickedError extends Error {
  constructor(allocationId: string) {
    super(`Allocation ${allocationId} has already been picked.`);
    this.name = 'AllocationAlreadyPickedError';
  }
}

export class BinNotActiveError extends Error {
  constructor(label: string) {
    super(`Bin "${label}" is not active and cannot be picked from.`);
    this.name = 'BinNotActiveError';
  }
}

export async function pickAllocation(
  ctx: TenantContext,
  args: { allocationId: string; scannedBinLabel: string; pickedByUserId: string },
) {
  return withTenantContext(ctx, async (tx) => {
    // RLS-load the allocation. Throws if not visible (cross-tenant or unknown).
    const allocation = await tx.orderLineAllocation.findUniqueOrThrow({
      where: { id: args.allocationId },
      include: {
        bin: { select: { id: true, label: true, status: true } },
        orderLineItem: {
          select: { id: true, skuId: true, orderId: true, clientId: true, companyId: true },
        },
      },
    });

    // Row-level lock on the parent Order. Serializes concurrent pickers on
    // the same order so the remaining-allocations count + final transition
    // happen atomically. Prisma's findUnique doesn't expose `FOR UPDATE`, so
    // use $queryRaw. The result we discard — we just want the lock.
    const orderId = allocation.orderLineItem.orderId;
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    // Re-read the order under the lock so we observe the post-lock status.
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (order.status !== OrderStatus.READY_TO_PICK && order.status !== OrderStatus.PICKING) {
      // Will throw IllegalStateTransitionError — captures the rule that
      // pick only runs from READY_TO_PICK or PICKING.
      assertTransition(order.status, OrderStatus.PICKING);
    }

    if (allocation.bin.status !== AccountStatus.ACTIVE) {
      throw new BinNotActiveError(allocation.bin.label);
    }

    // Trim + case-insensitive compare. Future barcode scanners paste raw
    // text into the input; normalizing here keeps both modes happy.
    const expected = allocation.bin.label.trim().toLowerCase();
    const actual = args.scannedBinLabel.trim().toLowerCase();
    if (expected !== actual) {
      throw new BinLabelMismatchError(allocation.bin.label, args.scannedBinLabel);
    }

    // Idempotent guard against double-pick. If pickedAt was already set,
    // updateMany returns count=0 and we throw.
    const now = new Date();
    const result = await tx.orderLineAllocation.updateMany({
      where: { id: allocation.id, pickedAt: null },
      data: { pickedAt: now, pickedByUserId: args.pickedByUserId },
    });
    if (result.count === 0) {
      throw new AllocationAlreadyPickedError(allocation.id);
    }

    // Decrement RESERVED stock on the (skuId, binId) row by the allocation
    // quantity. Row stays at 0 if fully consumed (matches 1.5 / cancel pattern).
    await tx.stockLevel.update({
      where: {
        skuId_binId_status: {
          skuId: allocation.orderLineItem.skuId,
          binId: allocation.binId,
          status: StockLevelStatus.RESERVED,
        },
      },
      data: { quantity: { decrement: allocation.quantityReserved } },
    });

    // Conditional state flips. First pick on the order: READY_TO_PICK → PICKING.
    if (order.status === OrderStatus.READY_TO_PICK) {
      assertTransition(OrderStatus.READY_TO_PICK, OrderStatus.PICKING);
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PICKING },
      });
    }

    // If this was the last un-picked allocation: PICKING → PICKED.
    const remaining = await tx.orderLineAllocation.count({
      where: {
        orderLineItem: { orderId },
        pickedAt: null,
      },
    });
    if (remaining === 0) {
      assertTransition(OrderStatus.PICKING, OrderStatus.PICKED);
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PICKED },
      });
    }

    return tx.orderLineAllocation.findUniqueOrThrow({
      where: { id: allocation.id },
      include: {
        bin: { select: { id: true, label: true } },
        pickedBy: { select: { id: true, name: true } },
      },
    });
  });
}

// Re-export Prisma's error for typed catch arms in tests.
export { Prisma };
