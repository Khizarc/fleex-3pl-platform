'use server';

// Portal-side server actions for bulk CSV order import (Milestone 1.6).
//
// Two endpoints:
//   - resolveSkusAction(codes)  — used by the client to flag unknown SKUs
//     in the preview. RLS-scoped to the portal caller's client.
//   - importOrdersAction(orders) — re-validates client-supplied groups,
//     then runs the serial bulkCreateOrders. Never throws.

import { z } from 'zod';
import { getCurrentClientContext } from '@/lib/auth';
import { bulkCreateOrders, type BulkCreateOrdersResult } from '@/features/orders';
import { resolveSkusByCode } from '@/features/products';

const groupedOrderSchema = z.object({
  groupKey: z.string().min(1).max(200),
  rowNumbers: z.array(z.number().int()).min(1),
  shipTo: z.object({
    name: z.string().trim().min(1).max(120),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().length(2),
  }),
  customerNote: z.string().trim().max(2000).optional(),
  lines: z
    .array(
      z.object({
        skuId: z.string().min(1),
        skuCode: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const MAX_GROUPS = 1000;

export async function resolveSkusAction(
  codes: string[],
): Promise<Record<string, { id: string; name: string } | null>> {
  if (!Array.isArray(codes) || codes.length === 0) return {};
  if (codes.length > 5000) {
    // Defensive cap. UI never sends this many but guard anyway.
    return {};
  }
  const { tenant } = await getCurrentClientContext();
  const map = await resolveSkusByCode(tenant, codes);
  return Object.fromEntries(map);
}

type ImportResult = { ok: true; data: BulkCreateOrdersResult } | { ok: false; error: string };

export async function importOrdersAction(orders: unknown[]): Promise<ImportResult> {
  if (!Array.isArray(orders)) {
    return { ok: false, error: 'Invalid payload: expected an array of orders.' };
  }
  if (orders.length === 0) {
    return { ok: false, error: 'No orders to import.' };
  }
  if (orders.length > MAX_GROUPS) {
    return { ok: false, error: `Too many orders: max ${MAX_GROUPS} per file.` };
  }

  const parsed = z.array(groupedOrderSchema).safeParse(orders);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid import payload',
    };
  }

  const { tenant, client, clientUser } = await getCurrentClientContext();

  // Re-resolve SKUs server-side as the source of truth — the client-supplied
  // skuId could be stale or tampered with. We re-look-up by code and use
  // those IDs (which RLS guarantees belong to the caller's client).
  const allCodes = parsed.data.flatMap((o) => o.lines.map((l) => l.skuCode));
  const skuMap = await resolveSkusByCode(tenant, allCodes);

  const resolvedOrders = parsed.data.map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({
      skuId: skuMap.get(l.skuCode)?.id ?? l.skuId,
      skuCode: l.skuCode,
      quantity: l.quantity,
    })),
  }));

  // Any code that didn't resolve becomes a per-order failure inside
  // bulkCreateOrders (createOrder rejects "SKUs do not belong to this client").
  const result = await bulkCreateOrders(tenant, {
    clientId: client.id,
    createdByClientUserId: clientUser.id,
    orders: resolvedOrders,
  });

  return { ok: true, data: result };
}
