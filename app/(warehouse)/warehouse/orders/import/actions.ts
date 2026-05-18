'use server';

// Staff-side server actions for bulk CSV order import (Milestone 1.6).
// Same shape as the portal actions but takes an explicit clientId on every
// call. RLS still confines the staff to their own company.

import { z } from 'zod';
import { getCurrentStaffContext } from '@/lib/auth';
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
  clientId: string,
  codes: string[],
): Promise<Record<string, { id: string; name: string } | null>> {
  if (!clientId) return {};
  if (!Array.isArray(codes) || codes.length === 0) return {};
  if (codes.length > 5000) return {};
  const { tenant } = await getCurrentStaffContext();
  const map = await resolveSkusByCode(tenant, codes, { clientId });
  return Object.fromEntries(map);
}

type ImportResult = { ok: true; data: BulkCreateOrdersResult } | { ok: false; error: string };

export async function importOrdersAction(
  clientId: string,
  orders: unknown[],
): Promise<ImportResult> {
  if (!clientId) {
    return { ok: false, error: 'Pick a client before importing.' };
  }
  if (!Array.isArray(orders) || orders.length === 0) {
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

  const { tenant, user } = await getCurrentStaffContext();

  const allCodes = parsed.data.flatMap((o) => o.lines.map((l) => l.skuCode));
  const skuMap = await resolveSkusByCode(tenant, allCodes, { clientId });

  const resolvedOrders = parsed.data.map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({
      skuId: skuMap.get(l.skuCode)?.id ?? l.skuId,
      skuCode: l.skuCode,
      quantity: l.quantity,
    })),
  }));

  const result = await bulkCreateOrders(tenant, {
    clientId,
    createdByUserId: user.id,
    orders: resolvedOrders,
  });

  return { ok: true, data: result };
}
