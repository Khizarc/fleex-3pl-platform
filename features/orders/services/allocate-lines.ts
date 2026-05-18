// Internal allocator. Called from inside an existing transaction by
// `createOrder` (initial allocation) and `allocateOrder` (retry).
//
// Algorithm:
//   1. Load the order + its line items (RLS-filtered by the caller's tx).
//   2. For each line, read AVAILABLE StockLevel rows for the line's SKU,
//      ordered by createdAt ASC (FIFO). Build a per-line bin-by-bin plan in
//      memory. If any line can't be fully covered, collect a `shortage` and
//      keep scanning the remaining lines (so the caller gets a full report).
//   3. If there were any shortages → return `{ ok: false, shortages }`
//      without writing anything. The caller transitions the order to
//      AWAITING_STOCK (or leaves it where it was on retry).
//   4. If every line is satisfiable → apply the plan: decrement AVAILABLE,
//      upsert RESERVED, upsert OrderLineAllocation. Then run the
//      negative-quantity guard (defense against concurrent allocations under
//      READ COMMITTED) — if any AVAILABLE row went < 0, throw and let the
//      surrounding transaction roll back.
//
// Note: this function does NOT update Order.status — the caller owns the
// state transition (via assertTransition + an order update).

import type { Prisma } from '@prisma/client';
import { StockLevelStatus } from '@prisma/client';

type Shortage = { skuId: string; needed: number; available: number };
type PlanStep = {
  lineItemId: string;
  skuId: string;
  binId: string;
  qty: number;
  clientId: string;
  companyId: string;
};

export type AllocationResult = { ok: true } | { ok: false; shortages: Shortage[] };

export async function runAllocation(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<AllocationResult> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: true },
  });

  const plan: PlanStep[] = [];
  const shortages: Shortage[] = [];

  for (const line of order.lines) {
    const stocks = await tx.stockLevel.findMany({
      where: { skuId: line.skuId, status: StockLevelStatus.AVAILABLE },
      orderBy: { createdAt: 'asc' },
      select: { binId: true, quantity: true },
    });

    let remaining = line.quantity;
    const linePlan: PlanStep[] = [];
    for (const s of stocks) {
      if (remaining <= 0) break;
      if (s.quantity <= 0) continue;
      const take = Math.min(remaining, s.quantity);
      linePlan.push({
        lineItemId: line.id,
        skuId: line.skuId,
        binId: s.binId,
        qty: take,
        clientId: line.clientId,
        companyId: line.companyId,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      const totalAvailable = stocks.reduce((acc, s) => acc + s.quantity, 0);
      shortages.push({
        skuId: line.skuId,
        needed: line.quantity,
        available: totalAvailable,
      });
      continue;
    }

    plan.push(...linePlan);
  }

  if (shortages.length > 0) {
    return { ok: false, shortages };
  }

  for (const step of plan) {
    await tx.stockLevel.update({
      where: {
        skuId_binId_status: {
          skuId: step.skuId,
          binId: step.binId,
          status: StockLevelStatus.AVAILABLE,
        },
      },
      data: { quantity: { decrement: step.qty } },
    });

    await tx.stockLevel.upsert({
      where: {
        skuId_binId_status: {
          skuId: step.skuId,
          binId: step.binId,
          status: StockLevelStatus.RESERVED,
        },
      },
      create: {
        skuId: step.skuId,
        binId: step.binId,
        status: StockLevelStatus.RESERVED,
        quantity: step.qty,
        clientId: step.clientId,
        companyId: step.companyId,
      },
      update: { quantity: { increment: step.qty } },
    });

    await tx.orderLineAllocation.upsert({
      where: {
        orderLineItemId_binId: {
          orderLineItemId: step.lineItemId,
          binId: step.binId,
        },
      },
      create: {
        orderLineItemId: step.lineItemId,
        binId: step.binId,
        quantityReserved: step.qty,
        clientId: step.clientId,
        companyId: step.companyId,
      },
      update: { quantityReserved: { increment: step.qty } },
    });
  }

  // Concurrency guard: if a concurrent allocator drove an AVAILABLE row
  // negative, throw — the surrounding transaction rolls back cleanly.
  const skuIds = order.lines.map((l) => l.skuId);
  const negativeRow = await tx.stockLevel.findFirst({
    where: {
      status: StockLevelStatus.AVAILABLE,
      skuId: { in: skuIds },
      quantity: { lt: 0 },
    },
    select: { id: true },
  });
  if (negativeRow) {
    throw new Error(
      'Concurrent allocation drove AVAILABLE stock below zero — transaction rolled back.',
    );
  }

  return { ok: true };
}
