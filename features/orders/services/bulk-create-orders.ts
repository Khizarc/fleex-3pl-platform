import { createOrder } from './create-order';
import type { GroupedOrder } from '../csv';
import type { TenantContext } from '@/lib/tenancy';

// Server-only orchestrator for bulk order import (Milestone 1.6).
//
// Iterates the validated grouped orders SERIALLY (not Promise.all). Serial
// is correct because 1.5's allocator does FIFO over shared StockLevel rows
// — running N createOrder calls in parallel against the same bins would
// produce the documented 1.5 concurrency race in real life. Serial keeps
// each call atomic and the negative-quantity guard never trips.
//
// Errors from individual createOrder calls are caught and bucketed into
// `failed`; the orchestrator never throws. The CSV-import use case is
// best-effort: a 100-order CSV with one bad SKU should land 99 orders and
// report 1 failure, not reject everything.

export type BulkCreateOrdersResult = {
  succeeded: { groupKey: string; orderId: string; reference: string; status: string }[];
  failed: { groupKey: string; message: string }[];
};

export async function bulkCreateOrders(
  ctx: TenantContext,
  args: {
    clientId: string;
    orders: GroupedOrder[];
    createdByUserId?: string;
    createdByClientUserId?: string;
  },
): Promise<BulkCreateOrdersResult> {
  const succeeded: BulkCreateOrdersResult['succeeded'] = [];
  const failed: BulkCreateOrdersResult['failed'] = [];

  for (const order of args.orders) {
    try {
      const created = await createOrder(ctx, {
        clientId: args.clientId,
        createdByUserId: args.createdByUserId,
        createdByClientUserId: args.createdByClientUserId,
        shipToName: order.shipTo.name,
        shipToLine1: order.shipTo.line1,
        shipToLine2: order.shipTo.line2,
        shipToCity: order.shipTo.city,
        shipToRegion: order.shipTo.region,
        shipToPostalCode: order.shipTo.postalCode,
        shipToCountry: order.shipTo.country,
        customerNote: order.customerNote,
        lines: order.lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
      });
      succeeded.push({
        groupKey: order.groupKey,
        orderId: created.id,
        reference: created.reference,
        status: created.status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      failed.push({ groupKey: order.groupKey, message });
    }
  }

  return { succeeded, failed };
}
